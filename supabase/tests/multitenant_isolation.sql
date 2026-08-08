begin;

-- Two deterministic tenants and one authenticated customer belonging only to Tenant A.
insert into public.tenants(id, name)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'RLS Tenant A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'RLS Tenant B');

insert into public.memberships(user_id, tenant_id, role)
values ('aaaaaaaa-1111-4111-8111-aaaaaaaa1111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'customer');

insert into public.settings(tenant_id)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2');

insert into public.tenant_service_accounts(tenant_id, plan_code, status)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'essential', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'essential', 'active');

insert into public.contacts(
  id, tenant_id, name, phone_e164, email,
  callback_requested, callback_requested_at, contact_permission_source
)
values
  ('aaaaaaaa-2222-4222-8222-aaaaaaaa2222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Contact A', '+390212345671', 'a@example.invalid', true, now(), 'integration_test'),
  ('bbbbbbbb-2222-4222-8222-bbbbbbbb2222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Contact B', '+390212345672', 'b@example.invalid', true, now(), 'integration_test');

insert into public.call_logs(
  id, tenant_id, contact_id, twilio_call_sid, direction, recording_url, outcome_json
)
values (
  'bbbbbbbb-3333-4333-8333-bbbbbbbb3333',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'bbbbbbbb-2222-4222-8222-bbbbbbbb2222',
  'CA00000000000000000000000000000001',
  'outbound',
  'https://recording.invalid/tenant-b.mp3',
  '{"call_status":"completed"}'::jsonb
);

insert into public.appointments(
  id, tenant_id, contact_id, title, start_at, end_at, status
)
values (
  'bbbbbbbb-4444-4444-8444-bbbbbbbb4444',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'bbbbbbbb-2222-4222-8222-bbbbbbbb2222',
  'Tenant B appointment',
  '2031-01-10T10:00:00Z',
  '2031-01-10T10:30:00Z',
  'scheduled'
);

insert into public.tenant_phone_numbers(
  id, tenant_id, phone_number, phone_type, status, provider_status, provider_account_owner, regulatory_status
)
values (
  'bbbbbbbb-5555-4555-8555-bbbbbbbb5555',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  '+390212345679',
  'voice',
  'pending',
  'pending',
  'platform',
  'not_started'
);

insert into public.tenant_knowledge(
  id, tenant_id, source_type, source_name, source_url, content_text, status
)
values (
  'bbbbbbbb-6666-4666-8666-bbbbbbbb6666',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'website',
  'Tenant B knowledge',
  'https://example.invalid/b',
  'private tenant B knowledge',
  'completed'
);

insert into public.google_tokens(
  tenant_id, access_token, refresh_token, token_expires_at
)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'test_access_token_b',
  'test_refresh_token_b',
  now() + interval '1 hour'
);

-- The voice-audio bucket must remain private; insert a test object as the DB owner.
insert into storage.objects(bucket_id, name)
values ('voice-audio', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2/rls-test.mp3');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-1111-4111-8111-aaaaaaaa1111","role":"authenticated"}',
  true
);

do $$
declare
  n integer;
begin
  -- Positive control: the authenticated app can read Tenant A's own contact.
  select count(*) into n
  from public.contacts
  where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  if n <> 1 then
    raise exception 'RLS positive control failed for Tenant A contacts';
  end if;

  -- Contacts B are neither readable nor mutable.
  select count(*) into n
  from public.contacts
  where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  if n <> 0 then raise exception 'Tenant A can read Tenant B contacts'; end if;

  update public.contacts
  set name = 'cross tenant write'
  where id = 'bbbbbbbb-2222-4222-8222-bbbbbbbb2222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Tenant A can modify Tenant B contacts'; end if;

  -- Calls and recording metadata B are hidden.
  select count(*) into n
  from public.call_logs
  where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  if n <> 0 then raise exception 'Tenant A can read Tenant B call logs/recordings'; end if;

  -- Appointments B are hidden.
  select count(*) into n
  from public.appointments
  where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  if n <> 0 then raise exception 'Tenant A can read Tenant B appointments'; end if;

  -- Voice configuration / phone number B is hidden.
  select count(*) into n
  from public.tenant_phone_numbers
  where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  if n <> 0 then raise exception 'Tenant A can read Tenant B Voice number'; end if;

  select count(*) into n
  from public.settings
  where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  if n <> 0 then raise exception 'Tenant A can read Tenant B settings'; end if;

  -- Knowledge B is hidden.
  select count(*) into n
  from public.tenant_knowledge
  where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  if n <> 0 then raise exception 'Tenant A can read Tenant B knowledge'; end if;

  -- Service status B is hidden. Normal tenant members have no UPDATE table privilege.
  select count(*) into n
  from public.tenant_service_accounts
  where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  if n <> 0 then raise exception 'Tenant A can read Tenant B service status'; end if;

  begin
    update public.tenant_service_accounts
    set admin_notes = 'cross tenant write'
    where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'Tenant A can modify Tenant B service status'; end if;
  exception
    when insufficient_privilege then null;
  end;

  -- OAuth token tables are not readable by authenticated clients at all.
  begin
    perform 1 from public.google_tokens
    where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
    raise exception 'Authenticated client can read Google tokens';
  exception
    when insufficient_privilege then null;
  end;

  -- A private TTS/Voice object must not be visible through authenticated Storage RLS.
  begin
    select count(*) into n
    from storage.objects
    where bucket_id = 'voice-audio'
      and name = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2/rls-test.mp3';
    if n <> 0 then raise exception 'Tenant A can read Tenant B voice audio object'; end if;
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;
rollback;
