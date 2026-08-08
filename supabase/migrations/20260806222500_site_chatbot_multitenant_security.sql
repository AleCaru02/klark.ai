-- Secure, tenant-isolated website chatbot.
-- Public visitors never access these tables directly: public traffic passes
-- through Edge Functions using a revocable widget key and signed session token.

create table if not exists public.site_chatbots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  public_key uuid not null unique default gen_random_uuid(),
  is_enabled boolean not null default false,
  display_name text not null default 'Assistente',
  welcome_message text not null default 'Ciao. Come posso aiutarti?',
  allowed_origins text[] not null default '{}',
  accent_color text not null default '#2563eb',
  position text not null default 'right',
  collect_name boolean not null default true,
  collect_email boolean not null default true,
  collect_phone boolean not null default false,
  require_consent boolean not null default true,
  consent_text text not null default 'Accetto che i dati inseriti siano utilizzati per rispondere alla richiesta e, se necessario, essere ricontattato.',
  create_crm_contact boolean not null default true,
  calendar_enabled boolean not null default false,
  escalation_enabled boolean not null default true,
  human_label text not null default 'Parla con una persona',
  max_messages_per_session integer not null default 24,
  rate_limit_per_minute integer not null default 8,
  monthly_message_limit integer not null default 1500,
  retention_days integer not null default 90,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_chatbots_accent_color_check check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint site_chatbots_position_check check (position in ('left', 'right')),
  constraint site_chatbots_max_messages_check check (max_messages_per_session between 1 and 100),
  constraint site_chatbots_rate_limit_check check (rate_limit_per_minute between 1 and 30),
  constraint site_chatbots_monthly_limit_check check (monthly_message_limit between 50 and 1000000),
  constraint site_chatbots_retention_check check (retention_days in (30, 90, 365, 730))
);

create table if not exists public.site_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chatbot_id uuid not null references public.site_chatbots(id) on delete cascade,
  session_token_hash text not null,
  origin text not null,
  ip_hash text not null,
  user_agent text,
  contact_id uuid references public.contacts(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'active',
  consent_at timestamptz,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint site_chat_sessions_status_check check (status in ('active', 'handoff_requested', 'closed', 'expired', 'revoked'))
);

create table if not exists public.site_chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chatbot_id uuid not null references public.site_chatbots(id) on delete cascade,
  session_id uuid not null references public.site_chat_sessions(id) on delete cascade,
  role text not null,
  content text not null,
  source_ids uuid[] not null default '{}',
  safety_status text not null default 'ok',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now(),
  constraint site_chat_messages_role_check check (role in ('user', 'assistant')),
  constraint site_chat_messages_safety_check check (safety_status in ('ok', 'limited', 'handoff', 'blocked')),
  constraint site_chat_messages_content_length check (char_length(content) between 1 and 8000)
);

create table if not exists public.usage_site_chat_daily (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  date date not null default current_date,
  messages integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  estimated_cost_cents numeric(12,4) not null default 0,
  primary key (tenant_id, date)
);

create index if not exists idx_site_chat_sessions_tenant_created
  on public.site_chat_sessions(tenant_id, created_at desc);
create index if not exists idx_site_chat_sessions_ip_created
  on public.site_chat_sessions(chatbot_id, ip_hash, created_at desc);
create index if not exists idx_site_chat_messages_session_created
  on public.site_chat_messages(session_id, created_at);
create index if not exists idx_site_chat_messages_tenant_created
  on public.site_chat_messages(tenant_id, created_at desc);

alter table public.site_chatbots enable row level security;
alter table public.site_chat_sessions enable row level security;
alter table public.site_chat_messages enable row level security;
alter table public.usage_site_chat_daily enable row level security;

-- Tenant users can configure and inspect only their own widget.
drop policy if exists "Tenant users can view own site chatbot" on public.site_chatbots;
create policy "Tenant users can view own site chatbot"
  on public.site_chatbots for select to authenticated
  using (public.user_belongs_to_tenant(auth.uid(), tenant_id));

drop policy if exists "Tenant users can insert own site chatbot" on public.site_chatbots;
create policy "Tenant users can insert own site chatbot"
  on public.site_chatbots for insert to authenticated
  with check (public.user_belongs_to_tenant(auth.uid(), tenant_id));

drop policy if exists "Tenant users can update own site chatbot" on public.site_chatbots;
create policy "Tenant users can update own site chatbot"
  on public.site_chatbots for update to authenticated
  using (public.user_belongs_to_tenant(auth.uid(), tenant_id))
  with check (public.user_belongs_to_tenant(auth.uid(), tenant_id));

drop policy if exists "Tenant users can delete own site chatbot" on public.site_chatbots;
create policy "Tenant users can delete own site chatbot"
  on public.site_chatbots for delete to authenticated
  using (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- Conversation content is read-only to tenant users; public visitors use service-role Edge Functions.
drop policy if exists "Tenant users can view own site chat sessions" on public.site_chat_sessions;
create policy "Tenant users can view own site chat sessions"
  on public.site_chat_sessions for select to authenticated
  using (public.user_belongs_to_tenant(auth.uid(), tenant_id));

drop policy if exists "Tenant users can view own site chat messages" on public.site_chat_messages;
create policy "Tenant users can view own site chat messages"
  on public.site_chat_messages for select to authenticated
  using (public.user_belongs_to_tenant(auth.uid(), tenant_id));

drop policy if exists "Tenant users can view own site chat usage" on public.usage_site_chat_daily;
create policy "Tenant users can view own site chat usage"
  on public.usage_site_chat_daily for select to authenticated
  using (public.user_belongs_to_tenant(auth.uid(), tenant_id));

revoke all on public.site_chatbots from anon;
revoke all on public.site_chat_sessions from anon;
revoke all on public.site_chat_messages from anon;
revoke all on public.usage_site_chat_daily from anon;

revoke insert, update, delete on public.site_chat_sessions from authenticated;
revoke insert, update, delete on public.site_chat_messages from authenticated;
revoke insert, update, delete on public.usage_site_chat_daily from authenticated;

grant select, insert, update, delete on public.site_chatbots to authenticated;
grant select on public.site_chat_sessions to authenticated;
grant select on public.site_chat_messages to authenticated;
grant select on public.usage_site_chat_daily to authenticated;

-- Existing phone records now explicitly identify the tenant-specific provider account.
alter table public.tenant_phone_numbers
  add column if not exists twilio_subaccount_sid text,
  add column if not exists provider_status text not null default 'pending',
  add column if not exists provider_account_owner text not null default 'platform',
  add column if not exists verified_at timestamptz,
  add column if not exists provisioning_error text;

alter table public.tenant_phone_numbers
  drop constraint if exists tenant_phone_numbers_provider_status_check;
alter table public.tenant_phone_numbers
  add constraint tenant_phone_numbers_provider_status_check
  check (provider_status in ('pending', 'provisioning', 'verified', 'error', 'suspended', 'released'));

alter table public.tenant_phone_numbers
  drop constraint if exists tenant_phone_numbers_provider_account_owner_check;
alter table public.tenant_phone_numbers
  add constraint tenant_phone_numbers_provider_account_owner_check
  check (provider_account_owner in ('platform', 'customer'));

-- Keep timestamps reliable.
drop trigger if exists set_site_chatbots_updated_at on public.site_chatbots;
create trigger set_site_chatbots_updated_at
before update on public.site_chatbots
for each row execute function public.update_updated_at_column();

create or replace function public.rotate_site_chatbot_key(p_chatbot_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chatbot public.site_chatbots%rowtype;
  v_key uuid := gen_random_uuid();
begin
  select * into v_chatbot from public.site_chatbots where id = p_chatbot_id;
  if not found then raise exception 'Chatbot not found'; end if;
  if not public.user_belongs_to_tenant(auth.uid(), v_chatbot.tenant_id) then
    raise exception 'Access denied';
  end if;

  update public.site_chatbots
  set public_key = v_key, is_enabled = false, updated_at = now()
  where id = p_chatbot_id;

  update public.site_chat_sessions
  set status = 'revoked', last_seen_at = now()
  where chatbot_id = p_chatbot_id and status = 'active';

  insert into public.audit_log (tenant_id, actor_user_id, action, payload_json)
  values (
    v_chatbot.tenant_id,
    auth.uid(),
    'site_chatbot.key_rotated',
    jsonb_build_object('chatbot_id', p_chatbot_id, 'disabled_after_rotation', true)
  );

  return v_key;
end;
$$;

revoke all on function public.rotate_site_chatbot_key(uuid) from public, anon;
grant execute on function public.rotate_site_chatbot_key(uuid) to authenticated;

create or replace function public.record_site_chat_usage(
  p_tenant_id uuid,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_cents numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usage_site_chat_daily (
    tenant_id, date, messages, input_tokens, output_tokens, estimated_cost_cents
  ) values (
    p_tenant_id,
    current_date,
    1,
    greatest(coalesce(p_input_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0),
    greatest(coalesce(p_estimated_cost_cents, 0), 0)
  )
  on conflict (tenant_id, date) do update set
    messages = public.usage_site_chat_daily.messages + 1,
    input_tokens = public.usage_site_chat_daily.input_tokens + excluded.input_tokens,
    output_tokens = public.usage_site_chat_daily.output_tokens + excluded.output_tokens,
    estimated_cost_cents = public.usage_site_chat_daily.estimated_cost_cents + excluded.estimated_cost_cents;
end;
$$;

revoke all on function public.record_site_chat_usage(uuid, integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.record_site_chat_usage(uuid, integer, integer, numeric) to service_role;

-- Product entitlements: chatbot is included from Growth upward.
update public.plans
set feature_flags = coalesce(feature_flags, '{}'::jsonb) || jsonb_build_object(
  'site_chat_enabled', case when code in ('growth', 'pro', 'enterprise') then true else false end,
  'site_chat_monthly_messages', case
    when code = 'growth' then 1500
    when code = 'pro' then 5000
    when code = 'enterprise' then 20000
    else 0
  end
)
where code in ('essential', 'growth', 'pro', 'enterprise');
