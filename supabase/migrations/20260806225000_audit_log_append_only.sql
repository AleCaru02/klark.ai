-- Audit records must be append-only. RLS does not protect TRUNCATE, so remove
-- inherited table privileges and grant only tenant-scoped read/append access.
alter table public.audit_log enable row level security;

create or replace function public.is_platform_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins
    where platform_admins.user_id = _user_id
  );
$$;

revoke all on function public.is_platform_admin(uuid) from public, anon;
grant execute on function public.is_platform_admin(uuid) to authenticated, service_role;

revoke all privileges on public.audit_log from anon;
revoke all privileges on public.audit_log from authenticated;
grant select, insert on public.audit_log to authenticated;

drop policy if exists "Admins can do everything on audit_log" on public.audit_log;
drop policy if exists "Customers can view own tenant audit_log" on public.audit_log;
drop policy if exists "Tenant users can view own audit log" on public.audit_log;
drop policy if exists "Tenant users can append own audit log" on public.audit_log;
drop policy if exists "Platform admins can view audit log" on public.audit_log;

create policy "Tenant users can view own audit log"
on public.audit_log for select to authenticated
using (public.user_belongs_to_tenant(auth.uid(), tenant_id));

create policy "Platform admins can view audit log"
on public.audit_log for select to authenticated
using (public.is_platform_admin(auth.uid()));

create policy "Tenant users can append own audit log"
on public.audit_log for insert to authenticated
with check (
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
  and actor_user_id = auth.uid()
);

create or replace function public.enforce_audit_actor()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' then
    new.actor_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_audit_actor_before_insert on public.audit_log;
create trigger enforce_audit_actor_before_insert
before insert on public.audit_log
for each row execute function public.enforce_audit_actor();

revoke all on function public.enforce_audit_actor() from public, anon;
grant execute on function public.enforce_audit_actor() to authenticated, service_role;
