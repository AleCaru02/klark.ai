do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.settings'::regclass
      and conname = 'settings_recording_notice_text_length'
  ) then
    alter table public.settings
      add constraint settings_recording_notice_text_length
      check (
        recording_notice_text is null
        or (
          char_length(trim(recording_notice_text)) >= 20
          and char_length(trim(recording_notice_text)) <= 500
        )
      );
  end if;
end $$;

create index if not exists idx_facebook_lead_imports_tenant_contact
  on public.facebook_lead_imports (tenant_id, contact_id);

create unique index if not exists tenant_phone_numbers_twilio_sid_unique
  on public.tenant_phone_numbers (twilio_sid)
  where twilio_sid is not null;

create unique index if not exists tenant_phone_numbers_twilio_subaccount_sid_unique
  on public.tenant_phone_numbers (twilio_subaccount_sid)
  where twilio_subaccount_sid is not null;
