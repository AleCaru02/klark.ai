begin;

insert into public.tenants(id, name)
values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'Privileged mutation tenant');

insert into public.memberships(user_id, tenant_id, role)
values
  ('cccccccc-1111-4111-8111-cccccccc1111', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'customer'),
  ('cccccccc-2222-4222-8222-cccccccc2222', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'admin');

insert into public.site_chatbots(id, tenant_id, display_name)
values ('cccccccc-3333-4333-8333-cccccccc3333', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'Security test chatbot');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-1111-4111-8111-cccccccc1111","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.rotate_site_chatbot_key('cccccccc-3333-4333-8333-cccccccc3333');
    raise exception 'Non-admin tenant member rotated the site chatbot key';
  exception
    when others then
      if sqlerrm = 'Non-admin tenant member rotated the site chatbot key' then
        raise;
      end if;
      if position('Tenant admin required' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-2222-4222-8222-cccccccc2222","role":"authenticated"}',
  true
);

select public.rotate_site_chatbot_key('cccccccc-3333-4333-8333-cccccccc3333');

reset role;
rollback;
