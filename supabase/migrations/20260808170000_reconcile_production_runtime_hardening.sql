-- Reconcile production hardening that was applied directly during launch preparation.
-- This migration is intentionally idempotent so a clean database reaches the same
-- Voice/consent/readiness contract as the currently hardened production schema.

begin;

-- Runtime readiness flags are server-managed and fail closed.
alter table public.settings
  add column if not exists voice_runtime_verified boolean not null default false,
  add column if not exists whatsapp_runtime_verified boolean not null default false,
  add column if not exists meta_autocall_runtime_verified boolean not null default false;

alter table public.settings drop constraint if exists settings_no_italian_mobile_caller_id;
alter table public.settings add constraint settings_no_italian_mobile_caller_id
  check (caller_id_e164 is null or caller_id_e164 !~ '^\+393');

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
         or coalesce(new.whatsapp_runtime_verified,false)
         or coalesce(new.meta_autocall_runtime_verified,false) then
        raise exception 'runtime verification flags are server-managed';
      end if;
    else
      if new.facebook_webhook_secret is distinct from old.facebook_webhook_secret then
        raise exception 'secret fields must be written by a server function';
      end if;
      if new.voice_runtime_verified is distinct from old.voice_runtime_verified
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
before insert or update of facebook_webhook_secret, voice_runtime_verified, whatsapp_runtime_verified, meta_autocall_runtime_verified
on public.settings
for each row execute function public.block_client_secret_writes();

-- Italian geographic Voice provisioning/regulatory state.
alter table public.tenant_phone_numbers
  add column if not exists regulatory_status text not null default 'not_started',
  add column if not exists regulatory_bundle_sid text,
  add column if not exists regulatory_address_sid text,
  add column if not exists regulatory_verified_at timestamptz,
  add column if not exists locality text,
  add column if not exists capabilities_json jsonb not null default '{}'::jsonb;

alter table public.tenant_phone_numbers drop constraint if exists tenant_phone_numbers_regulatory_status_check;
alter table public.tenant_phone_numbers add constraint tenant_phone_numbers_regulatory_status_check
  check (regulatory_status = any (array['not_started','pending','approved','rejected','not_required']::text[]));

alter table public.tenant_phone_numbers drop constraint if exists tenant_phone_numbers_active_voice_compliance;
alter table public.tenant_phone_numbers add constraint tenant_phone_numbers_active_voice_compliance
  check (
    not (phone_type='voice' and status='active')
    or (
      country_code='IT'
      and phone_number ~ '^\+390[0-9]+$'
      and provider_account_owner='platform'
      and provider_status='verified'
      and twilio_sid ~ '^PN[0-9A-Fa-f]{32}$'
      and twilio_subaccount_sid ~ '^AC[0-9A-Fa-f]{32}$'
      and verified_at is not null
      and regulatory_status='approved'
      and regulatory_verified_at is not null
    )
  );

create or replace function public.is_compliant_voice_number(
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
    where p.tenant_id=p_tenant_id
      and p.phone_type='voice'
      and p.status='active'
      and p.provider_status='verified'
      and p.country_code='IT'
      and p.phone_number ~ '^\+390[0-9]+$'
      and (p_phone_number is null or p.phone_number=p_phone_number)
      and p.provider_account_owner='platform'
      and p.twilio_sid ~ '^PN[0-9A-Fa-f]{32}$'
      and p.twilio_subaccount_sid ~ '^AC[0-9A-Fa-f]{32}$'
      and p.verified_at is not null
      and p.regulatory_status='approved'
      and p.regulatory_verified_at is not null
  );
$$;

create or replace function public.enforce_voice_number_runtime_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  runtime_ok boolean;
begin
  if new.phone_type='voice' and (new.status='active' or new.provider_status='verified') then
    select coalesce(s.voice_runtime_verified,false)
      into runtime_ok
      from public.settings s
      where s.tenant_id=new.tenant_id;
    if not coalesce(runtime_ok,false) then
      raise exception 'Voice number cannot be activated before voice runtime verification';
    end if;
    if new.country_code <> 'IT'
       or new.phone_number !~ '^\+390[0-9]+$'
       or new.provider_account_owner <> 'platform'
       or new.twilio_sid is null
       or new.twilio_subaccount_sid is null
       or new.verified_at is null
       or new.regulatory_status <> 'approved'
       or new.regulatory_verified_at is null then
      raise exception 'Voice number is not a compliant provisioned Italian geographic number';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_voice_number_runtime_gate on public.tenant_phone_numbers;
create trigger trg_enforce_voice_number_runtime_gate
before insert or update on public.tenant_phone_numbers
for each row execute function public.enforce_voice_number_runtime_gate();

create or replace function public.enforce_runtime_channel_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.voice_number is not null and not public.is_compliant_voice_number(new.tenant_id,new.voice_number) then
    raise exception 'voice_number must match an active compliant Italian geographic Voice number';
  end if;
  if new.caller_id_e164 is not null and not public.is_compliant_voice_number(new.tenant_id,new.caller_id_e164) then
    raise exception 'caller_id_e164 must match an active compliant Italian geographic Voice number';
  end if;
  if coalesce(new.voice_enabled,false) then
    if not coalesce(new.voice_runtime_verified,false) then
      raise exception 'Voice runtime is not verified';
    end if;
    if not public.is_compliant_voice_number(new.tenant_id,null) then
      raise exception 'No compliant Italian geographic Voice number is active';
    end if;
  end if;
  if coalesce(new.whatsapp_enabled,false) then
    if not coalesce(new.whatsapp_runtime_verified,false) then
      raise exception 'WhatsApp runtime is not verified';
    end if;
    if not exists (select 1 from public.whatsapp_integrations w where w.tenant_id=new.tenant_id) then
      raise exception 'WhatsApp integration is missing';
    end if;
  end if;
  if coalesce(new.auto_call_on_lead,false) then
    if not coalesce(new.meta_autocall_runtime_verified,false) then
      raise exception 'Meta auto-call runtime is not verified';
    end if;
    if not coalesce(new.voice_enabled,false) then
      raise exception 'Voice must be enabled before Meta auto-call';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_runtime_channel_settings on public.settings;
create trigger trg_enforce_runtime_channel_settings
before insert or update on public.settings
for each row execute function public.enforce_runtime_channel_settings();

create or replace function public.sync_settings_voice_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant uuid;
  old_phone text;
begin
  tenant := coalesce(new.tenant_id,old.tenant_id);
  old_phone := case when tg_op='INSERT' then null else old.phone_number end;
  if tg_op <> 'DELETE' and new.phone_type='voice' and public.is_compliant_voice_number(new.tenant_id,new.phone_number) then
    update public.settings
      set voice_number=new.phone_number, caller_id_e164=new.phone_number, updated_at=now()
      where tenant_id=new.tenant_id;
    return null;
  end if;
  if old_phone is not null then
    update public.settings
      set voice_number=case when voice_number=old_phone then null else voice_number end,
          caller_id_e164=case when caller_id_e164=old_phone then null else caller_id_e164 end,
          voice_enabled=case when voice_number=old_phone or caller_id_e164=old_phone then false else voice_enabled end,
          auto_call_on_lead=case when voice_number=old_phone or caller_id_e164=old_phone then false else auto_call_on_lead end,
          updated_at=now()
      where tenant_id=tenant and (voice_number=old_phone or caller_id_e164=old_phone);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_settings_voice_number on public.tenant_phone_numbers;
create trigger trg_sync_settings_voice_number
after insert or delete or update on public.tenant_phone_numbers
for each row execute function public.sync_settings_voice_number();

-- Call queue statuses actually emitted by the runtime.
alter table public.call_queue drop constraint if exists call_queue_status_check;
alter table public.call_queue add constraint call_queue_status_check
  check (status = any (array['pending','processing','calling','completed','booked','no_answer','failed','cancelled']::text[]));

-- Contact permission evidence.
alter table public.contacts
  add column if not exists callback_requested boolean not null default false,
  add column if not exists callback_requested_at timestamptz,
  add column if not exists contact_permission_source text,
  add column if not exists whatsapp_opt_in boolean not null default false,
  add column if not exists whatsapp_opt_in_at timestamptz,
  add column if not exists whatsapp_opt_in_source text,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists marketing_opt_in_at timestamptz,
  add column if not exists marketing_opt_in_source text;

alter table public.contacts drop constraint if exists contacts_callback_evidence_check;
alter table public.contacts add constraint contacts_callback_evidence_check
  check (not callback_requested or (callback_requested_at is not null and nullif(trim(contact_permission_source),'') is not null));
alter table public.contacts drop constraint if exists contacts_whatsapp_opt_in_evidence_check;
alter table public.contacts add constraint contacts_whatsapp_opt_in_evidence_check
  check (not whatsapp_opt_in or (whatsapp_opt_in_at is not null and nullif(trim(whatsapp_opt_in_source),'') is not null));
alter table public.contacts drop constraint if exists contacts_marketing_opt_in_evidence_check;
alter table public.contacts add constraint contacts_marketing_opt_in_evidence_check
  check (not marketing_opt_in or (marketing_opt_in_at is not null and nullif(trim(marketing_opt_in_source),'') is not null));

create or replace function public.enforce_call_queue_do_not_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare blocked boolean;
begin
  select coalesce(c.do_not_contact,false) into blocked
  from public.contacts c where c.id=new.contact_id and c.tenant_id=new.tenant_id;
  if blocked and new.status in ('pending','calling','no_answer','processing') then
    new.status := 'cancelled';
    new.last_error_code := 'do_not_contact';
    new.notes := case when coalesce(new.notes,'')='' then 'Contatto escluso: do_not_contact attivo.' else left(new.notes || ' | Contatto escluso: do_not_contact attivo.',2000) end;
    new.locked_at := null;
    new.worker_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_call_queue_do_not_contact on public.call_queue;
create trigger trg_enforce_call_queue_do_not_contact
before insert or update of status on public.call_queue
for each row execute function public.enforce_call_queue_do_not_contact();

create or replace function public.enforce_call_queue_contact_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_meta_lead boolean;
  callback_ok boolean;
begin
  if new.status not in ('pending','processing','calling','no_answer') then return new; end if;
  select (
    exists(select 1 from public.contact_sources cs where cs.tenant_id=new.tenant_id and cs.contact_id=new.contact_id and cs.source='facebook_leadads')
    or exists(select 1 from public.facebook_lead_imports fi where fi.tenant_id=new.tenant_id and fi.contact_id=new.contact_id)
  ), coalesce(c.callback_requested,false)
  into is_meta_lead, callback_ok
  from public.contacts c where c.tenant_id=new.tenant_id and c.id=new.contact_id;
  if coalesce(is_meta_lead,false) and not coalesce(callback_ok,false) then
    new.status := 'cancelled';
    new.last_error_code := 'contact_permission_missing';
    new.notes := case when coalesce(new.notes,'')='' then 'Lead Meta salvato ma non chiamabile: richiesta di ricontatto non verificata.' else left(new.notes || ' | Lead Meta non chiamabile: richiesta di ricontatto non verificata.',2000) end;
    new.locked_at := null;
    new.worker_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_call_queue_contact_permission on public.call_queue;
create trigger trg_enforce_call_queue_contact_permission
before insert or update on public.call_queue
for each row execute function public.enforce_call_queue_contact_permission();

-- WhatsApp state is retained for Phase 2 but remains fail closed.
alter table public.whatsapp_integrations
  add column if not exists connection_mode text not null default 'api_only',
  add column if not exists coexistence_verified_at timestamptz;
alter table public.whatsapp_integrations drop constraint if exists whatsapp_integrations_connection_mode_check;
alter table public.whatsapp_integrations add constraint whatsapp_integrations_connection_mode_check
  check (connection_mode = any (array['api_only','coexistence']::text[]));
alter table public.whatsapp_integrations drop constraint if exists whatsapp_integrations_coexistence_verified_check;
alter table public.whatsapp_integrations add constraint whatsapp_integrations_coexistence_verified_check
  check (connection_mode <> 'coexistence' or coexistence_verified_at is not null);

create or replace function public.enforce_whatsapp_runtime_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare runtime_ok boolean;
begin
  select coalesce(s.whatsapp_runtime_verified,false) into runtime_ok from public.settings s where s.tenant_id=new.tenant_id;
  if not coalesce(runtime_ok,false) then raise exception 'WhatsApp integration cannot be activated before runtime verification'; end if;
  if new.connection_mode='coexistence' and new.coexistence_verified_at is null then raise exception 'Coexistence must be explicitly verified before use'; end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_whatsapp_runtime_gate on public.whatsapp_integrations;
create trigger trg_enforce_whatsapp_runtime_gate
before insert or update on public.whatsapp_integrations
for each row execute function public.enforce_whatsapp_runtime_gate();

-- Structured number assessment fields for assisted onboarding.
alter table public.demo_requests
  add column if not exists existing_number_type text,
  add column if not exists current_operator text,
  add column if not exists desired_inbound_mode text,
  add column if not exists wants_whatsapp_same_number text,
  add column if not exists whatsapp_current_type text,
  add column if not exists wants_portability text,
  add column if not exists number_assessment_status text not null default 'preliminary';

alter table public.demo_requests drop constraint if exists demo_requests_existing_number_type_check;
alter table public.demo_requests add constraint demo_requests_existing_number_type_check
  check (existing_number_type is null or existing_number_type = any (array['mobile','geographic','toll_free','other','unknown']::text[]));
alter table public.demo_requests drop constraint if exists demo_requests_inbound_mode_check;
alter table public.demo_requests add constraint demo_requests_inbound_mode_check
  check (desired_inbound_mode is null or desired_inbound_mode = any (array['keep_direct','forward_always','forward_no_answer','forward_busy','evaluate']::text[]));
alter table public.demo_requests drop constraint if exists demo_requests_whatsapp_same_check;
alter table public.demo_requests add constraint demo_requests_whatsapp_same_check
  check (wants_whatsapp_same_number is null or wants_whatsapp_same_number = any (array['yes','no','unknown']::text[]));
alter table public.demo_requests drop constraint if exists demo_requests_whatsapp_type_check;
alter table public.demo_requests add constraint demo_requests_whatsapp_type_check
  check (whatsapp_current_type is null or whatsapp_current_type = any (array['personal','business_app','business_platform','none','unknown']::text[]));
alter table public.demo_requests drop constraint if exists demo_requests_portability_check;
alter table public.demo_requests add constraint demo_requests_portability_check
  check (wants_portability is null or wants_portability = any (array['yes','no','evaluate']::text[]));
alter table public.demo_requests drop constraint if exists demo_requests_number_assessment_status_check;
alter table public.demo_requests add constraint demo_requests_number_assessment_status_check
  check (number_assessment_status = any (array['preliminary','manual_review','compatible_forwarding','portability_review','not_compatible','verified']::text[]));

create or replace view public.tenant_channel_readiness
with (security_invoker=true)
as
select
  t.id as tenant_id,
  s.voice_enabled,
  s.voice_runtime_verified,
  vp.phone_number as voice_number,
  vp.provider_status as voice_provider_status,
  vp.status as voice_number_status,
  vp.regulatory_status as voice_regulatory_status,
  vp.regulatory_verified_at,
  (vp.id is not null and vp.country_code='IT' and vp.phone_number ~ '^\+390[0-9]+$' and vp.provider_account_owner='platform' and vp.provider_status='verified' and vp.status='active' and vp.twilio_sid is not null and vp.twilio_subaccount_sid is not null and vp.verified_at is not null and vp.regulatory_status='approved' and vp.regulatory_verified_at is not null) as voice_number_compliant,
  (coalesce(s.voice_enabled,false) and coalesce(s.voice_runtime_verified,false) and vp.id is not null and vp.country_code='IT' and vp.phone_number ~ '^\+390[0-9]+$' and vp.provider_account_owner='platform' and vp.provider_status='verified' and vp.status='active' and vp.twilio_sid is not null and vp.twilio_subaccount_sid is not null and vp.verified_at is not null and vp.regulatory_status='approved' and vp.regulatory_verified_at is not null) as voice_ready,
  s.whatsapp_enabled,
  s.whatsapp_runtime_verified,
  wi.display_phone_number as whatsapp_number,
  wi.connection_mode as whatsapp_connection_mode,
  wi.coexistence_verified_at,
  (coalesce(s.whatsapp_enabled,false) and coalesce(s.whatsapp_runtime_verified,false) and wi.tenant_id is not null and (wi.connection_mode <> 'coexistence' or wi.coexistence_verified_at is not null)) as whatsapp_ready,
  s.auto_call_on_lead,
  s.meta_autocall_runtime_verified,
  (coalesce(s.auto_call_on_lead,false) and coalesce(s.meta_autocall_runtime_verified,false) and coalesce(s.voice_enabled,false) and coalesce(s.voice_runtime_verified,false) and vp.id is not null and vp.status='active' and vp.provider_status='verified' and vp.regulatory_status='approved' and vp.regulatory_verified_at is not null) as meta_autocall_ready
from public.tenants t
left join public.settings s on s.tenant_id=t.id
left join public.tenant_phone_numbers vp on vp.tenant_id=t.id and vp.phone_type='voice'
left join public.whatsapp_integrations wi on wi.tenant_id=t.id;

revoke all on public.tenant_channel_readiness from public, anon;
grant select on public.tenant_channel_readiness to authenticated, service_role;

-- Trigger functions are not callable APIs.
revoke all on function public.enforce_call_queue_do_not_contact() from public, anon, authenticated;
revoke all on function public.enforce_call_queue_contact_permission() from public, anon, authenticated;
revoke all on function public.enforce_voice_number_runtime_gate() from public, anon, authenticated;
revoke all on function public.enforce_runtime_channel_settings() from public, anon, authenticated;
revoke all on function public.sync_settings_voice_number() from public, anon, authenticated;
revoke all on function public.enforce_whatsapp_runtime_gate() from public, anon, authenticated;
revoke all on function public.block_client_secret_writes() from public, anon;

grant execute on function public.enforce_call_queue_do_not_contact() to service_role;
grant execute on function public.enforce_call_queue_contact_permission() to service_role;
grant execute on function public.enforce_voice_number_runtime_gate() to service_role;
grant execute on function public.enforce_runtime_channel_settings() to service_role;
grant execute on function public.sync_settings_voice_number() to service_role;
grant execute on function public.enforce_whatsapp_runtime_gate() to service_role;
grant execute on function public.block_client_secret_writes() to authenticated, service_role;

commit;
