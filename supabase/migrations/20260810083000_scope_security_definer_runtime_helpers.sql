-- Prevent authenticated callers from using SECURITY DEFINER runtime helpers
-- to enumerate other tenants while preserving service-role/internal DB usage.

create or replace function public.is_platform_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when _user_id is null then false
    when auth.uid() is not null
      and _user_id <> auth.uid()
      and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
      then false
    else exists (
      select 1
      from public.platform_admins
      where platform_admins.user_id = _user_id
    )
  end;
$function$;

create or replace function public.is_tenant_service_active(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when p_tenant_id is null then false
    when coalesce(auth.jwt() ->> 'role', '') = 'service_role' then exists (
      select 1
      from public.tenant_service_accounts tsa
      where tsa.tenant_id = p_tenant_id
        and tsa.status = 'active'
        and (tsa.service_end_at is null or tsa.service_end_at > now())
    )
    when auth.uid() is not null
      and public.user_belongs_to_tenant(auth.uid(), p_tenant_id) then exists (
      select 1
      from public.tenant_service_accounts tsa
      where tsa.tenant_id = p_tenant_id
        and tsa.status = 'active'
        and (tsa.service_end_at is null or tsa.service_end_at > now())
    )
    -- Trigger/cron/database-owner executions do not carry an Auth JWT.
    when auth.uid() is null and coalesce(auth.jwt() ->> 'role', '') = '' then exists (
      select 1
      from public.tenant_service_accounts tsa
      where tsa.tenant_id = p_tenant_id
        and tsa.status = 'active'
        and (tsa.service_end_at is null or tsa.service_end_at > now())
    )
    else false
  end;
$function$;

create or replace function public.is_compliant_voice_number(
  p_tenant_id uuid,
  p_phone_number text default null::text
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when p_tenant_id is null then false
    when coalesce(auth.jwt() ->> 'role', '') = 'service_role' then exists (
      select 1
      from public.tenant_phone_numbers p
      where p.tenant_id = p_tenant_id
        and p.phone_type = 'voice'
        and p.status = 'active'
        and p.provider_status = 'verified'
        and p.country_code = 'IT'
        and p.phone_number ~ '^\+390[0-9]+$'
        and (p_phone_number is null or p.phone_number = p_phone_number)
        and p.provider_account_owner = 'platform'
        and p.twilio_sid ~ '^PN[0-9A-Fa-f]{32}$'
        and p.twilio_subaccount_sid ~ '^AC[0-9A-Fa-f]{32}$'
        and p.verified_at is not null
        and p.regulatory_status = 'approved'
        and p.regulatory_verified_at is not null
    )
    when auth.uid() is not null
      and public.user_belongs_to_tenant(auth.uid(), p_tenant_id) then exists (
      select 1
      from public.tenant_phone_numbers p
      where p.tenant_id = p_tenant_id
        and p.phone_type = 'voice'
        and p.status = 'active'
        and p.provider_status = 'verified'
        and p.country_code = 'IT'
        and p.phone_number ~ '^\+390[0-9]+$'
        and (p_phone_number is null or p.phone_number = p_phone_number)
        and p.provider_account_owner = 'platform'
        and p.twilio_sid ~ '^PN[0-9A-Fa-f]{32}$'
        and p.twilio_subaccount_sid ~ '^AC[0-9A-Fa-f]{32}$'
        and p.verified_at is not null
        and p.regulatory_status = 'approved'
        and p.regulatory_verified_at is not null
    )
    when auth.uid() is null and coalesce(auth.jwt() ->> 'role', '') = '' then exists (
      select 1
      from public.tenant_phone_numbers p
      where p.tenant_id = p_tenant_id
        and p.phone_type = 'voice'
        and p.status = 'active'
        and p.provider_status = 'verified'
        and p.country_code = 'IT'
        and p.phone_number ~ '^\+390[0-9]+$'
        and (p_phone_number is null or p.phone_number = p_phone_number)
        and p.provider_account_owner = 'platform'
        and p.twilio_sid ~ '^PN[0-9A-Fa-f]{32}$'
        and p.twilio_subaccount_sid ~ '^AC[0-9A-Fa-f]{32}$'
        and p.verified_at is not null
        and p.regulatory_status = 'approved'
        and p.regulatory_verified_at is not null
    )
    else false
  end;
$function$;

revoke execute on function public.is_platform_admin(uuid) from public, anon;
grant execute on function public.is_platform_admin(uuid) to authenticated, service_role;

revoke execute on function public.is_tenant_service_active(uuid) from public, anon;
grant execute on function public.is_tenant_service_active(uuid) to authenticated, service_role;

revoke execute on function public.is_compliant_voice_number(uuid, text) from public, anon;
grant execute on function public.is_compliant_voice_number(uuid, text) to authenticated, service_role;
