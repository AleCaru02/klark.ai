-- Reconcile production objects that existed in Lovable Cloud but were not yet versioned.
-- This migration is replay-safe and keeps all client-facing access fail-closed.

create table if not exists public.call_recordings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  call_log_id uuid not null,
  twilio_recording_sid text not null,
  twilio_account_sid text not null,
  storage_path text,
  status text not null default 'processing',
  duration_seconds integer,
  byte_size bigint,
  mime_type text,
  provider_deleted_at timestamptz,
  ready_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  audio_transcript_text text,
  transcription_segments_json jsonb not null default '[]'::jsonb,
  transcription_status text not null default 'pending',
  transcription_model text,
  transcription_error text,
  transcribed_at timestamptz,
  constraint call_recordings_tenant_call_fkey foreign key (tenant_id, call_log_id)
    references public.call_logs(tenant_id, id) on delete cascade,
  constraint call_recordings_account_sid_check check (twilio_account_sid ~ '^AC[0-9A-Za-z]{30,40}$'),
  constraint call_recordings_audio_transcript_length check (audio_transcript_text is null or char_length(audio_transcript_text) <= 100000),
  constraint call_recordings_byte_size_check check (byte_size is null or byte_size >= 0),
  constraint call_recordings_duration_check check (duration_seconds is null or duration_seconds >= 0),
  constraint call_recordings_sid_check check (twilio_recording_sid ~ '^RE[0-9A-Za-z]{30,40}$'),
  constraint call_recordings_status_check check (status = any (array['processing','ready','error','deleted']::text[])),
  constraint call_recordings_storage_path_check check (storage_path is null or storage_path !~ '(^/|\.\.)'),
  constraint call_recordings_transcription_status_check check (transcription_status = any (array['pending','processing','ready','error','too_large','disabled']::text[]))
);

create index if not exists idx_call_recordings_tenant_created
  on public.call_recordings (tenant_id, created_at desc);
create index if not exists idx_call_recordings_transcription_pending
  on public.call_recordings (tenant_id, transcription_status, created_at)
  where transcription_status = any (array['pending','processing']::text[]);
create unique index if not exists uq_call_recordings_tenant_call
  on public.call_recordings (tenant_id, call_log_id);
create unique index if not exists uq_call_recordings_twilio_recording_sid
  on public.call_recordings (twilio_recording_sid);

alter table public.call_recordings enable row level security;

drop policy if exists "Platform admins can view call recordings" on public.call_recordings;
create policy "Platform admins can view call recordings"
  on public.call_recordings for select to authenticated
  using (public.is_platform_admin(auth.uid()));

drop policy if exists "Tenant users can view own call recordings" on public.call_recordings;
create policy "Tenant users can view own call recordings"
  on public.call_recordings for select to authenticated
  using (public.user_belongs_to_tenant(auth.uid(), tenant_id));

drop trigger if exists set_call_recordings_updated_at on public.call_recordings;
create trigger set_call_recordings_updated_at
  before update on public.call_recordings
  for each row execute function public.update_updated_at_column();

revoke all on table public.call_recordings from anon;
grant select on table public.call_recordings to authenticated;
grant all on table public.call_recordings to service_role;

create table if not exists public.contact_ai_memory (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid not null,
  summary_text text not null default '',
  topics_json jsonb not null default '[]'::jsonb,
  verified_facts_json jsonb not null default '{}'::jsonb,
  intent text,
  next_step text,
  last_channel text,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_ai_memory_pkey primary key (tenant_id, contact_id),
  constraint contact_ai_memory_tenant_contact_fkey foreign key (tenant_id, contact_id)
    references public.contacts(tenant_id, id) on delete cascade,
  constraint contact_ai_memory_channel_check check (last_channel is null or last_channel = any (array['voice','site_chat','whatsapp','manual']::text[])),
  constraint contact_ai_memory_intent_length check (intent is null or char_length(intent) <= 1000),
  constraint contact_ai_memory_next_step_length check (next_step is null or char_length(next_step) <= 1500),
  constraint contact_ai_memory_summary_length check (char_length(summary_text) <= 12000)
);

create index if not exists idx_contact_ai_memory_tenant_recent
  on public.contact_ai_memory (tenant_id, last_interaction_at desc);

alter table public.contact_ai_memory enable row level security;

drop policy if exists "Platform admins can view contact AI memory" on public.contact_ai_memory;
create policy "Platform admins can view contact AI memory"
  on public.contact_ai_memory for select to authenticated
  using (public.is_platform_admin(auth.uid()));

drop policy if exists "Tenant users can view own contact AI memory" on public.contact_ai_memory;
create policy "Tenant users can view own contact AI memory"
  on public.contact_ai_memory for select to authenticated
  using (public.user_belongs_to_tenant(auth.uid(), tenant_id));

drop trigger if exists set_contact_ai_memory_updated_at on public.contact_ai_memory;
create trigger set_contact_ai_memory_updated_at
  before update on public.contact_ai_memory
  for each row execute function public.update_updated_at_column();

revoke all on table public.contact_ai_memory from anon;
grant select on table public.contact_ai_memory to authenticated;
grant all on table public.contact_ai_memory to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('call-recordings', 'call-recordings', false, 104857600, array['audio/mpeg']::text[])
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
