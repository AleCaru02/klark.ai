-- Fase 1: stato cliente amministrativo interno, indipendente da Stripe.
-- Nessuna subscription provider viene creata o richiesta per attivare l'MVP.

begin;

create table if not exists public.tenant_service_accounts (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  plan_code text not null references public.plans(code),
  status text not null default 'pending',
  activated_at timestamptz,
  service_end_at timestamptz,
  renewal_due_at timestamptz,
  next_payment_at timestamptz,
  admin_notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_service_accounts_status_check
    check (status in ('pending', 'active', 'suspended', 'cancelled')),
  constraint tenant_service_accounts_service_window_check
    check (service_end_at is null or activated_at is null or service_end_at >= activated_at)
);

alter table public.tenant_service_accounts enable row level security;

revoke all on public.tenant_service_accounts from public, anon, authenticated;
grant select, insert, update, delete on public.tenant_service_accounts to authenticated;
grant all on public.tenant_service_accounts to service_role;

drop policy if exists "Tenant users can read service account" on public.tenant_service_accounts;
create policy "Tenant users can read service account"
on public.tenant_service_accounts
for select to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

drop policy if exists "Platform admins can insert service accounts" on public.tenant_service_accounts;
create policy "Platform admins can insert service accounts"
on public.tenant_service_accounts
for insert to authenticated
with check (public.is_platform_admin(auth.uid()));

drop policy if exists "Platform admins can update service accounts" on public.tenant_service_accounts;
create policy "Platform admins can update service accounts"
on public.tenant_service_accounts
for update to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

drop policy if exists "Platform admins can delete service accounts" on public.tenant_service_accounts;
create policy "Platform admins can delete service accounts"
on public.tenant_service_accounts
for delete to authenticated
using (public.is_platform_admin(auth.uid()));

create or replace function public.set_tenant_service_account_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  if new.status = 'active' and new.activated_at is null then
    new.activated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.set_tenant_service_account_audit_fields() from public, anon;
grant execute on function public.set_tenant_service_account_audit_fields() to authenticated, service_role;

drop trigger if exists trg_tenant_service_account_audit_fields on public.tenant_service_accounts;
create trigger trg_tenant_service_account_audit_fields
before insert or update on public.tenant_service_accounts
for each row execute function public.set_tenant_service_account_audit_fields();

create or replace function public.is_tenant_service_active(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_service_accounts tsa
    where tsa.tenant_id = p_tenant_id
      and tsa.status = 'active'
      and (tsa.service_end_at is null or tsa.service_end_at > now())
  );
$$;

revoke all on function public.is_tenant_service_active(uuid) from public, anon;
grant execute on function public.is_tenant_service_active(uuid) to authenticated, service_role;

-- Queue claiming is fail-closed: inactive or expired tenants are never moved to processing.
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
    where q.status in ('pending', 'no_answer')
      and public.is_tenant_service_active(q.tenant_id)
      and coalesce(q.retry_after, q.next_attempt_at, now()) <= now()
      and (q.locked_at is null or q.locked_at < now() - interval '10 minutes')
    order by q.priority desc nulls last, q.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.call_queue q
  set status = 'processing', locked_at = now(), worker_id = p_worker_id, updated_at = now()
  from picked
  where q.id = picked.id
  returning q.*;
end;
$$;

revoke all on function public.claim_call_queue_batch(integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_call_queue_batch(integer, uuid) to service_role;

-- Existing development tenants fail closed. Preserve an existing assigned plan if
-- present; otherwise use the current MVP base plan.
insert into public.tenant_service_accounts (tenant_id, plan_code, status)
select
  t.id,
  coalesce(
    (
      select s.plan_code
      from public.subscriptions s
      where s.tenant_id = t.id
      order by s.created_at desc
      limit 1
    ),
    'essential'
  ),
  'pending'
from public.tenants t
on conflict (tenant_id) do nothing;

-- A non-active tenant must not leave callable work in the queue.
update public.call_queue q
set
  status = 'cancelled',
  last_error_code = 'tenant_not_active',
  locked_at = null,
  worker_id = null,
  updated_at = now()
where q.status in ('pending', 'processing', 'calling')
  and not public.is_tenant_service_active(q.tenant_id);

create or replace function public.enforce_call_queue_active_tenant()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status in ('pending', 'processing', 'calling')
     and not public.is_tenant_service_active(new.tenant_id) then
    raise exception 'tenant service is not active';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_call_queue_active_tenant() from public, anon, authenticated;
grant execute on function public.enforce_call_queue_active_tenant() to service_role;

drop trigger if exists trg_enforce_call_queue_active_tenant on public.call_queue;
create trigger trg_enforce_call_queue_active_tenant
before insert or update of status, tenant_id on public.call_queue
for each row execute function public.enforce_call_queue_active_tenant();

-- Suspension/cancellation immediately disables runtime channels and queued calls.
create or replace function public.apply_tenant_service_status_runtime_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_tenant_service_active(new.tenant_id) then
    update public.settings
    set
      voice_enabled = false,
      whatsapp_enabled = false,
      auto_call_on_lead = false
    where tenant_id = new.tenant_id;

    update public.call_queue
    set
      status = 'cancelled',
      last_error_code = 'tenant_not_active',
      locked_at = null,
      worker_id = null,
      updated_at = now()
    where tenant_id = new.tenant_id
      and status in ('pending', 'processing', 'calling');
  end if;
  return new;
end;
$$;

revoke all on function public.apply_tenant_service_status_runtime_gate() from public, anon, authenticated;
grant execute on function public.apply_tenant_service_status_runtime_gate() to service_role;

drop trigger if exists trg_apply_tenant_service_status_runtime_gate on public.tenant_service_accounts;
create trigger trg_apply_tenant_service_status_runtime_gate
after insert or update of status, service_end_at on public.tenant_service_accounts
for each row execute function public.apply_tenant_service_status_runtime_gate();

commit;
