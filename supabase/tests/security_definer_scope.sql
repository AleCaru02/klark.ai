begin;

insert into public.tenants(id, name)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'RPC Tenant A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'RPC Tenant B');

insert into public.memberships(user_id, tenant_id, role)
values ('aaaaaaaa-1111-4111-8111-aaaaaaaa1111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'customer');

insert into public.tenant_service_accounts(tenant_id, plan_code, status)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'essential', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'essential', 'active');

insert into public.tenant_phone_numbers(
  id,
  tenant_id,
  phone_number,
  phone_type,
  status,
  provider_status,
  provider_account_owner,
  country_code,
  twilio_sid,
  twilio_subaccount_sid,
  verified_at,
  regulatory_status,
  regulatory_verified_at
)
values (
  'bbbbbbbb-5555-4555-8555-bbbbbbbb5555',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  '+390212345679',
  'voice',
  'active',
  'verified',
  'platform',
  'IT',
  'PNaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'ACbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  now(),
  'approved',
  now()
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-1111-4111-8111-aaaaaaaa1111","role":"authenticated"}',
  true
);

do $$
begin
  if not public.is_tenant_service_active('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') then
    raise exception 'Tenant A cannot read its own active service state';
  end if;

  if public.is_tenant_service_active('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2') then
    raise exception 'Tenant A can enumerate Tenant B service state through SECURITY DEFINER RPC';
  end if;

  if public.is_compliant_voice_number('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '+390212345679') then
    raise exception 'Tenant A can enumerate Tenant B Voice compliance through SECURITY DEFINER RPC';
  end if;
end
$$;

reset role;
rollback;
