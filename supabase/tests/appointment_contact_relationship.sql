begin;

do $$
declare
  relationship_count integer;
  composite_definition text;
begin
  select count(*)
  into relationship_count
  from pg_constraint
  where conrelid = 'public.appointments'::regclass
    and confrelid = 'public.contacts'::regclass
    and contype = 'f';

  if relationship_count <> 1 then
    raise exception 'Expected exactly one appointments-to-contacts FK, found %', relationship_count;
  end if;

  select pg_get_constraintdef(oid)
  into composite_definition
  from pg_constraint
  where conrelid = 'public.appointments'::regclass
    and confrelid = 'public.contacts'::regclass
    and contype = 'f';

  if composite_definition not like 'FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts(tenant_id, id)%' then
    raise exception 'Tenant-scoped appointments contact FK missing: %', composite_definition;
  end if;
end
$$;

rollback;
