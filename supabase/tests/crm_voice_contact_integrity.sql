begin;

insert into public.tenants(id, name)
values
  ('f1111111-1111-4111-8111-111111111111', 'CRM Tenant A'),
  ('f2222222-2222-4222-8222-222222222222', 'CRM Tenant B');

insert into public.contacts(id, tenant_id, name, phone_e164)
values
  ('f1111111-aaaa-4aaa-8aaa-111111111111', 'f1111111-1111-4111-8111-111111111111', 'Caller A', '+393331234567'),
  ('f2222222-bbbb-4bbb-8bbb-222222222222', 'f2222222-2222-4222-8222-222222222222', 'Caller B', '+393331234567');

-- Same E.164 value is valid across two tenants, never twice in one tenant.
do $$
begin
  begin
    insert into public.contacts(tenant_id, name, phone_e164)
    values ('f1111111-1111-4111-8111-111111111111', 'Duplicate caller', '+393331234567');
    raise exception 'Duplicate tenant phone was accepted';
  exception
    when unique_violation then null;
  end;

  begin
    insert into public.contacts(tenant_id, name, phone_e164)
    values ('f1111111-1111-4111-8111-111111111111', 'Malformed caller', '3331234567');
    raise exception 'Non-E.164 phone was accepted';
  exception
    when check_violation then null;
  end;
end
$$;

-- Tenant-aware foreign keys prevent a call or appointment from being attached
-- to a contact owned by another tenant.
do $$
begin
  begin
    insert into public.call_logs(tenant_id, contact_id, twilio_call_sid)
    values ('f1111111-1111-4111-8111-111111111111', 'f2222222-bbbb-4bbb-8bbb-222222222222', 'CA11111111111111111111111111111111');
    raise exception 'Cross-tenant call association was accepted';
  exception
    when foreign_key_violation then null;
  end;

  begin
    insert into public.appointments(tenant_id, contact_id, start_at, end_at)
    values (
      'f1111111-1111-4111-8111-111111111111',
      'f2222222-bbbb-4bbb-8bbb-222222222222',
      now() + interval '7 days',
      now() + interval '7 days 30 minutes'
    );
    raise exception 'Cross-tenant appointment association was accepted';
  exception
    when foreign_key_violation then null;
  end;
end
$$;

rollback;
