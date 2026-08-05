-- REVIEW BEFORE APPLYING.
-- Blocca la lettura client-side dei token e limita le esposizioni anonime/globali.

begin;

-- Token OAuth e API: accesso soltanto da funzioni server-side/service role.
drop policy if exists "Customers can view own tenant google_tokens" on public.google_tokens;
drop policy if exists "Customers can view own tenant facebook_integrations" on public.facebook_integrations;
drop policy if exists "Customers can view own tenant whatsapp_integrations" on public.whatsapp_integrations;

-- I client non devono poter scrivere direttamente un access token WhatsApp.
drop policy if exists "Customers can insert own tenant whatsapp_integrations" on public.whatsapp_integrations;
drop policy if exists "Customers can update own tenant whatsapp_integrations" on public.whatsapp_integrations;
drop policy if exists "Customers can delete own tenant whatsapp_integrations" on public.whatsapp_integrations;

-- Le impostazioni contengono facebook_webhook_secret: niente SELECT/UPDATE diretto dal browser.
drop policy if exists "Customers can view own tenant settings" on public.settings;
drop policy if exists "Customers can update own tenant settings" on public.settings;

-- Evita enumerazione anonima di tutti i codici referral.
drop policy if exists "Anyone can lookup referral code" on public.referral_codes;

-- Gli eventi globali/null-tenant sono riservati agli admin.
drop policy if exists "Authenticated can view null-tenant audit_log" on public.audit_log;

-- Stato sicuro delle integrazioni: nessun token restituito.
create or replace function public.get_my_integration_status()
returns table (
  tenant_id uuid,
  google_connected boolean,
  google_calendar_id text,
  google_token_expires_at timestamptz,
  facebook_connected boolean,
  facebook_page_id text,
  facebook_form_id text,
  facebook_token_expires_at timestamptz,
  whatsapp_connected boolean,
  whatsapp_phone_number_id text,
  whatsapp_display_phone_number text,
  whatsapp_verified_name text,
  whatsapp_token_expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with my_tenants as (
    select m.tenant_id
    from public.memberships m
    where m.user_id = auth.uid()
  )
  select
    mt.tenant_id,
    (gt.access_token is not null) as google_connected,
    gt.calendar_id,
    gt.token_expires_at,
    (fi.access_token is not null or fi.user_access_token is not null) as facebook_connected,
    fi.page_id,
    fi.form_id,
    fi.token_expires_at,
    (wi.access_token is not null) as whatsapp_connected,
    wi.phone_number_id,
    wi.display_phone_number,
    wi.verified_name,
    wi.token_expires_at
  from my_tenants mt
  left join public.google_tokens gt on gt.tenant_id = mt.tenant_id
  left join public.facebook_integrations fi on fi.tenant_id = mt.tenant_id
  left join public.whatsapp_integrations wi on wi.tenant_id = mt.tenant_id;
$$;

revoke all on function public.get_my_integration_status() from public;
grant execute on function public.get_my_integration_status() to authenticated;

-- Lookup puntuale referral: non restituisce user_id o tenant_id.
create or replace function public.lookup_referral_code(input_code text)
returns table (valid boolean, code text)
language sql
stable
security definer
set search_path = public
as $$
  select true, rc.code
  from public.referral_codes rc
  where lower(rc.code) = lower(trim(input_code))
  limit 1;
$$;

revoke all on function public.lookup_referral_code(text) from public;
grant execute on function public.lookup_referral_code(text) to anon, authenticated;

commit;
