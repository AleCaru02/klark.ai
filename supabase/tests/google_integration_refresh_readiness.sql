begin;

insert into public.tenants(id, name)
values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'Google readiness test tenant');

insert into public.memberships(user_id, tenant_id, role)
values ('cccccccc-1111-4111-8111-cccccccc1111', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'customer');

insert into public.google_tokens(
  tenant_id,
  access_token,
  refresh_token,
  token_expires_at,
  calendar_id
)
values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  'expired_test_access_token',
  'test_refresh_token',
  now() - interval '1 hour',
  'primary'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-1111-4111-8111-cccccccc1111","role":"authenticated"}',
  true
);

do $$
declare
  status jsonb;
begin
  status := public.get_integration_status();

  if coalesce((status #>> '{google,connected}')::boolean, false) is not true then
    raise exception 'Refreshable Google integration was not reported connected';
  end if;

  if coalesce((status #>> '{google,expired}')::boolean, true) is not false then
    raise exception 'Expired access token with refresh token incorrectly requires reconnection';
  end if;

  if coalesce((status #>> '{google,access_token_expired}')::boolean, false) is not true then
    raise exception 'Expired access token diagnostic was not preserved';
  end if;

  if coalesce((status #>> '{google,refresh_available}')::boolean, false) is not true then
    raise exception 'Refresh availability diagnostic missing';
  end if;
end
$$;

reset role;

-- refresh_token is NOT NULL by schema; an empty value is the fail-closed
-- representation of an unusable/missing refresh credential for this test.
update public.google_tokens
set refresh_token = ''
where tenant_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-1111-4111-8111-cccccccc1111","role":"authenticated"}',
  true
);

do $$
declare
  status jsonb;
begin
  status := public.get_integration_status();

  if coalesce((status #>> '{google,expired}')::boolean, false) is not true then
    raise exception 'Expired access token without usable refresh token must require reconnection';
  end if;

  if coalesce((status #>> '{google,refresh_available}')::boolean, true) is not false then
    raise exception 'Empty refresh token must not be reported available';
  end if;
end
$$;

reset role;
rollback;