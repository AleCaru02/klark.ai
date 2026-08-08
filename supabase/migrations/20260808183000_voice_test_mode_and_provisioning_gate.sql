-- Voice can be provisioned and tested before customer activation without weakening
-- the production readiness gate. Test mode is server-managed and never enables
-- automated queue processing.

begin;

alter table public.settings
  add column if not exists voice_test_mode boolean not null default false;

create or replace function public.block_client_secret_writes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  role_name text := coalesce(auth.jwt()->>'role','');
begin
  if role_name <> 'service_role' then
    if tg_op = 'INSERT' then
      if new.facebook_webhook_secret is not null then
        raise exception 'secret fields must be written by a server function';
      end if;
      if coalesce(new.voice_runtime_verified,false)
         or coalesce(new.voice_test_mode,false)
         or coalesce(new.whatsapp_runtime_verified,false)
         or coalesce(new.meta_autocall_runtime_verified,false) then
        raise exception 'runtime verification flags are server-managed';
      end if;
    else
      if new.facebook_webhook_secret is distinct from old.facebook_webhook_secret then
        raise exception 'secret fields must be written by a server function';
      end if;
      if new.voice_runtime_verified is distinct from old.voice_runtime_verified
         or new.voice_test_mode is distinct from old.voice_test_mode
         or new.whatsapp_runtime_verified is distinct from old.whatsapp_runtime_verified
         or new.meta_autocall_runtime_verified is distinct from old.meta_autocall_runtime_verified then
        raise exception 'runtime verification flags are server-managed';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_client_secret_writes on public.settings;
create trigger trg_block_client_secret_writes
before insert or update of facebook_webhook_secret, voice_runtime_verified, voice_test_mode, whatsapp_runtime_verified, meta_autocall_runtime_verified
on public.settings
for each row execute function public.block_client_secret_writes();

-- A testable number is fully provisioned and regulatory-approved, but can remain
-- status=pending until the live call certification is complete.
create or replace function public.is_testable_voice_number(
  p_tenant_id uuid,
  p_phone_number text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_phone_numbers p
    where p.tenant_id = p_tenant_id
      and p.phone_type = 'voice'
      and p.status in ('pending','active')
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
  );
$$;
revoke all on function public.is_testable_voice_number(uuid,text) from public, anon, authenticated;
grant execute on function public.is_testable_voice_number(uuid,text) to service_role;

create or replace function public.enforce_voice_number_runtime_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  runtime_ok boolean;
begin
  if new.phone_type = 'voice' and new.provider_status = 'verified' then
    if new.country_code <> 'IT'
       or new.phone_number !~ '^\+390[0-9]+$'
       or new.provider_account_owner <> 'platform'
       or new.twilio_sid !~ '^PN[0-9A-Fa-f]{32}$'
       or new.twilio_subaccount_sid !~ '^AC[0-9A-Fa-f]{32}$'
       or new.verified_at is null
       or new.regulatory_status <> 'approved'
       or new.regulatory_verified_at is null then
      raise exception 'Verified Voice number is not a provisioned regulatory-approved Italian geographic number';
    end if;
  end if;

  if new.phone_type = 'voice' and new.status = 'active' then
    select coalesce(s.voice_runtime_verified,false)
      into runtime_ok
      from public.settings s
      where s.tenant_id = new.tenant_id;
    if not coalesce(runtime_ok,false) then
      raise exception 'Voice number cannot be activated before voice runtime verification';
    end if;
    if new.provider_status <> 'verified' then
      raise exception 'Active Voice number must be provider verified';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_voice_number_runtime_gate on public.tenant_phone_numbers;
create trigger trg_enforce_voice_number_runtime_gate
before insert or update on public.tenant_phone_numbers
for each row execute function public.enforce_voice_number_runtime_gate();

-- If the customer lifecycle is not active, test mode is also forcibly disabled.
create or replace function public.apply_tenant_service_status_runtime_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_tenant_service_active(new.tenant_id) then
    update public.settings
      set voice_enabled = false,
          voice_test_mode = false,
          whatsapp_enabled = false,
          auto_call_on_lead = false
      where tenant_id = new.tenant_id;
    update public.call_queue
      set status = 'cancelled',
          last_error_code = 'tenant_not_active',
          locked_at = null,
          worker_id = null,
          updated_at = now()
      where tenant_id = new.tenant_id
        and status in ('pending','processing','calling');
  end if;
  return new;
end;
$$;

revoke all on function public.apply_tenant_service_status_runtime_gate() from public, anon, authenticated;
grant execute on function public.apply_tenant_service_status_runtime_gate() to service_role;

commit;
