-- Production-safe scheduler for outbound Voice call queue.
-- The HTTP scheduler token is generated inside Supabase Vault. The Edge Function
-- validates it server-side before doing any work. Project URL is environment-specific
-- and is intentionally configured separately in Vault as call_queue_project_url.

begin;

create table if not exists public.worker_heartbeats (
  worker_name text primary key,
  status text not null default 'unknown',
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_success_at timestamptz,
  last_worker_id uuid,
  last_error text,
  updated_at timestamptz not null default now(),
  constraint worker_heartbeats_status_check check (status in ('unknown','running','idle','ok','error'))
);

alter table public.worker_heartbeats enable row level security;
revoke all on public.worker_heartbeats from public, anon, authenticated;
grant select, insert, update on public.worker_heartbeats to service_role;

-- Generate a scheduler token once. It never appears in source or client code.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'call_queue_scheduler_token') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'call_queue_scheduler_token',
      'ClarkAI internal call queue scheduler token'
    );
  end if;
end;
$$;

create or replace function public.verify_call_queue_scheduler_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = public, vault
as $$
  select coalesce(
    length(coalesce(p_token, '')) >= 32
    and exists (
      select 1
      from vault.decrypted_secrets s
      where s.name = 'call_queue_scheduler_token'
        and s.decrypted_secret = p_token
    ),
    false
  );
$$;
revoke all on function public.verify_call_queue_scheduler_token(text) from public, anon, authenticated;
grant execute on function public.verify_call_queue_scheduler_token(text) to service_role;

-- Recover records that can otherwise remain locked forever after worker/provider failures.
create or replace function public.recover_stale_call_queue()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  recovered_processing integer := 0;
  recovered_calling integer := 0;
begin
  update public.call_queue q
  set status = 'pending',
      locked_at = null,
      worker_id = null,
      retry_after = greatest(coalesce(q.retry_after, now()), now() + interval '1 minute'),
      next_attempt_at = greatest(coalesce(q.next_attempt_at, now()), now() + interval '1 minute'),
      last_error_code = 'worker_lock_expired',
      notes = 'Worker interrotto prima dell avvio chiamata: lock recuperato automaticamente.',
      updated_at = now()
  where q.status = 'processing'
    and q.locked_at is not null
    and q.locked_at < now() - interval '5 minutes';
  get diagnostics recovered_processing = row_count;

  update public.call_queue q
  set status = case when coalesce(q.attempt_count, 0) >= coalesce(q.max_attempts, 3) then 'failed' else 'no_answer' end,
      locked_at = null,
      worker_id = null,
      retry_after = case
        when coalesce(q.attempt_count, 0) >= coalesce(q.max_attempts, 3) then q.retry_after
        else now() + interval '15 minutes'
      end,
      next_attempt_at = case
        when coalesce(q.attempt_count, 0) >= coalesce(q.max_attempts, 3) then q.next_attempt_at
        else now() + interval '15 minutes'
      end,
      last_error_code = case
        when coalesce(q.attempt_count, 0) >= coalesce(q.max_attempts, 3) then 'max_attempts_reached'
        else 'call_status_timeout'
      end,
      notes = 'Chiamata rimasta in stato calling oltre 30 minuti: stato recuperato automaticamente.',
      updated_at = now()
  where q.status = 'calling'
    and coalesce(q.last_attempt_at, q.locked_at, q.updated_at) < now() - interval '30 minutes';
  get diagnostics recovered_calling = row_count;

  return jsonb_build_object(
    'processing', recovered_processing,
    'calling', recovered_calling
  );
end;
$$;
revoke all on function public.recover_stale_call_queue() from public, anon, authenticated;
grant execute on function public.recover_stale_call_queue() to service_role;

-- Claim only records that already satisfy the hard server-side eligibility gates.
create or replace function public.claim_call_queue_batch(
  p_limit integer default 10,
  p_worker_id uuid default gen_random_uuid()
)
returns setof public.call_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select q.id
    from public.call_queue q
    join public.contacts c
      on c.id = q.contact_id and c.tenant_id = q.tenant_id
    join public.settings s
      on s.tenant_id = q.tenant_id
    where q.status in ('pending','no_answer')
      and public.is_tenant_service_active(q.tenant_id)
      and s.voice_enabled = true
      and s.voice_runtime_verified = true
      and coalesce(c.do_not_contact, false) = false
      and c.callback_requested = true
      and c.callback_requested_at is not null
      and nullif(trim(c.contact_permission_source), '') is not null
      and coalesce(q.attempt_count, 0) < coalesce(q.max_attempts, 3)
      and coalesce(q.retry_after, q.next_attempt_at, now()) <= now()
      and (q.locked_at is null or q.locked_at < now() - interval '10 minutes')
      and exists (
        select 1
        from public.tenant_phone_numbers p
        where p.tenant_id = q.tenant_id
          and p.phone_type = 'voice'
          and p.status = 'active'
          and p.provider_status = 'verified'
          and p.regulatory_status = 'approved'
          and p.regulatory_verified_at is not null
          and public.is_compliant_voice_number(q.tenant_id, p.phone_number)
      )
    order by q.priority desc nulls last, q.created_at
    for update of q skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.call_queue q
  set status = 'processing',
      locked_at = now(),
      worker_id = p_worker_id,
      updated_at = now()
  from picked
  where q.id = picked.id
  returning q.*;
end;
$$;
revoke all on function public.claim_call_queue_batch(integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_call_queue_batch(integer, uuid) to service_role;

-- Invoke the HTTP worker only when the environment-specific project URL is configured.
create or replace function public.invoke_call_queue_worker()
returns bigint
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  project_url text;
  scheduler_token text;
  request_id bigint;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'call_queue_project_url'
  limit 1;

  select decrypted_secret into scheduler_token
  from vault.decrypted_secrets
  where name = 'call_queue_scheduler_token'
  limit 1;

  if project_url is null or scheduler_token is null then
    raise exception 'Call queue scheduler Vault configuration is incomplete';
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/process-call-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-clark-scheduler-token', scheduler_token
    ),
    body := jsonb_build_object('scheduled_at', now()),
    timeout_milliseconds := 15000
  ) into request_id;

  return request_id;
end;
$$;
revoke all on function public.invoke_call_queue_worker() from public, anon, authenticated;
grant execute on function public.invoke_call_queue_worker() to service_role;

create or replace function public.run_call_queue_scheduler_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recover_stale_call_queue();
  perform public.invoke_call_queue_worker();
exception
  when others then
    insert into public.worker_heartbeats (
      worker_name, status, last_started_at, last_finished_at, last_error, updated_at
    ) values (
      'call_queue', 'error', now(), now(), left(sqlerrm, 1000), now()
    )
    on conflict (worker_name) do update
      set status = excluded.status,
          last_finished_at = excluded.last_finished_at,
          last_error = excluded.last_error,
          updated_at = excluded.updated_at;
    raise;
end;
$$;
revoke all on function public.run_call_queue_scheduler_tick() from public, anon, authenticated;
grant execute on function public.run_call_queue_scheduler_tick() to service_role;

create or replace function public.ensure_call_queue_scheduler()
returns boolean
language plpgsql
security definer
set search_path = public, vault, cron
as $$
declare
  project_url text;
  existing_job bigint;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'call_queue_project_url'
  limit 1;

  if project_url is null then
    return false;
  end if;

  select jobid into existing_job
  from cron.job
  where jobname = 'process-call-queue'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'process-call-queue',
    '* * * * *',
    'select public.run_call_queue_scheduler_tick();'
  );
  return true;
end;
$$;
revoke all on function public.ensure_call_queue_scheduler() from public, anon, authenticated;
grant execute on function public.ensure_call_queue_scheduler() to service_role;

commit;
