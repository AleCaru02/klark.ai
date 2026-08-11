begin;

insert into public.tenants(id, name)
values ('a3333333-3333-4333-8333-333333333333', 'Knowledge governance tenant');

insert into public.memberships(user_id, tenant_id, role)
values
  ('a3333333-1111-4111-8111-333333331111', 'a3333333-3333-4333-8333-333333333333', 'customer'),
  ('a3333333-2222-4222-8222-333333332222', 'a3333333-3333-4333-8333-333333333333', 'admin');

insert into public.tenant_knowledge(
  id, tenant_id, source_type, source_name, content_text, status
) values (
  'a3333333-4444-4444-8444-333333334444',
  'a3333333-3333-4333-8333-333333333333',
  'pdf',
  'Policy test',
  'Questo è contenuto elaborato che richiede approvazione.',
  'pending_review'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a3333333-1111-4111-8111-333333331111","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.set_knowledge_source_governance(
      'a3333333-4444-4444-8444-333333334444',
      'approved',
      now() + interval '30 days',
      'checksum-customer',
      'should fail'
    );
    raise exception 'Non-admin tenant member approved a knowledge source';
  exception
    when others then
      if sqlerrm = 'Non-admin tenant member approved a knowledge source' then raise; end if;
      if position('Only tenant administrators' in sqlerrm) = 0 then raise; end if;
  end;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"a3333333-2222-4222-8222-333333332222","role":"authenticated"}',
  true
);

select public.set_knowledge_source_governance(
  'a3333333-4444-4444-8444-333333334444',
  'approved',
  now() + interval '30 days',
  'checksum-admin',
  'reviewed'
);

do $$
declare
  row_data public.tenant_knowledge%rowtype;
begin
  select * into row_data from public.tenant_knowledge where id='a3333333-4444-4444-8444-333333334444';
  if row_data.status <> 'completed' or row_data.approved_at is null or row_data.approved_by is null or row_data.approval_version <> 1 then
    raise exception 'Approved source did not become explicitly runtime-approved';
  end if;
end
$$;

select public.set_knowledge_source_governance(
  'a3333333-4444-4444-8444-333333334444',
  'revoked',
  null,
  null,
  'revoked for test'
);

do $$
declare
  row_data public.tenant_knowledge%rowtype;
begin
  select * into row_data from public.tenant_knowledge where id='a3333333-4444-4444-8444-333333334444';
  if row_data.status <> 'pending_review' or row_data.approved_at is not null or row_data.approved_by is not null then
    raise exception 'Revoked source remained runtime-approved';
  end if;
end
$$;

reset role;
rollback;
