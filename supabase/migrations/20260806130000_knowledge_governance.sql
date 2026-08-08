-- Knowledge sources are not active until a tenant administrator records approval.
-- History remains in audit_log through knowledge.source_approved/revoked/reviewed events.

create or replace function public.enforce_knowledge_governance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_action text;
  latest_payload jsonb;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    select al.action, al.payload_json
      into latest_action, latest_payload
    from public.audit_log al
    where al.tenant_id = new.tenant_id
      and al.action in ('knowledge.source_approved', 'knowledge.source_revoked', 'knowledge.source_expired')
      and al.payload_json ->> 'source_id' = new.id::text
    order by al.created_at desc
    limit 1;

    if latest_action is distinct from 'knowledge.source_approved'
      or coalesce((latest_payload ->> 'expires_at')::timestamptz, 'infinity'::timestamptz) <= now()
    then
      new.status := 'pending_review';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_knowledge_governance() from public;

 drop trigger if exists tenant_knowledge_governance_guard on public.tenant_knowledge;
create trigger tenant_knowledge_governance_guard
before update of status on public.tenant_knowledge
for each row
execute function public.enforce_knowledge_governance();

create or replace function public.expire_knowledge_approvals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  with latest_event as (
    select distinct on (al.payload_json ->> 'source_id')
      al.payload_json ->> 'source_id' as source_id,
      al.action,
      al.payload_json,
      al.created_at
    from public.audit_log al
    where al.action in ('knowledge.source_approved', 'knowledge.source_revoked', 'knowledge.source_expired')
      and al.payload_json ? 'source_id'
    order by al.payload_json ->> 'source_id', al.created_at desc
  ), expired as (
    select tk.id, tk.tenant_id
    from public.tenant_knowledge tk
    join latest_event le on le.source_id = tk.id::text
    where tk.status = 'completed'
      and (
        le.action <> 'knowledge.source_approved'
        or coalesce((le.payload_json ->> 'expires_at')::timestamptz, 'infinity'::timestamptz) <= now()
      )
  ), changed as (
    update public.tenant_knowledge tk
    set status = 'pending_review', updated_at = now()
    from expired e
    where tk.id = e.id
    returning tk.id, tk.tenant_id
  )
  insert into public.audit_log (tenant_id, action, payload_json)
  select tenant_id, 'knowledge.source_expired', jsonb_build_object(
    'source_id', id,
    'expired_at', now(),
    'reason', 'Approval expired or was revoked'
  )
  from changed;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_knowledge_approvals() from public;
grant execute on function public.expire_knowledge_approvals() to service_role;

-- Idempotent cron registration.
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'expire-knowledge-approvals' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'expire-knowledge-approvals',
    '15 * * * *',
    'select public.expire_knowledge_approvals();'
  );
end;
$$;
