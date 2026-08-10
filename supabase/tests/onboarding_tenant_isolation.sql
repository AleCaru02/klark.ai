begin;

insert into public.tenants(id, name)
values
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', 'Onboarding Tenant A'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5', 'Onboarding Tenant B');

insert into public.memberships(user_id, tenant_id, role)
values
  ('dddddddd-1111-4111-8111-dddddddd1111', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4', 'customer'),
  ('eeeeeeee-1111-4111-8111-eeeeeeee1111', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5', 'customer');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"dddddddd-1111-4111-8111-dddddddd1111","role":"authenticated"}',
  true
);

insert into public.tenant_business_profiles(tenant_id, city, country_code)
values ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', 'Milano', 'IT');

insert into public.tenant_services(tenant_id, name, duration_minutes)
values ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', 'Servizio tenant A', 30);

insert into public.tenant_faqs(tenant_id, question, answer)
values ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', 'Domanda tenant A?', 'Risposta tenant A');

insert into public.tenant_schedule_exceptions(tenant_id, exception_date, is_closed, note)
values ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', date '2026-12-25', true, 'Chiuso');

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.tenant_business_profiles
  where tenant_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5';
  if visible_count <> 0 then
    raise exception 'Tenant A can read Tenant B business profile';
  end if;

  begin
    insert into public.tenant_services(tenant_id, name)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5', 'Cross-tenant service');
    raise exception 'Tenant A inserted a service into Tenant B';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm = 'Tenant A inserted a service into Tenant B' then raise; end if;
      if position('row-level security' in lower(sqlerrm)) = 0 then raise; end if;
  end;

  begin
    insert into public.tenant_faqs(tenant_id, question, answer)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5', 'Cross tenant?', 'No');
    raise exception 'Tenant A inserted an FAQ into Tenant B';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm = 'Tenant A inserted an FAQ into Tenant B' then raise; end if;
      if position('row-level security' in lower(sqlerrm)) = 0 then raise; end if;
  end;
end
$$;

reset role;
rollback;
