-- Voice and CRM use phone_e164 as the stable identity of a caller within a tenant.
-- Enforce the invariant in Postgres so concurrent inbound webhooks cannot create
-- duplicate contacts and malformed numbers cannot enter through another path.

do $$
begin
  if exists (
    select 1
    from public.contacts
    where phone_e164 is not null
      and phone_e164 !~ '^\+[1-9][0-9]{7,14}$'
  ) then
    raise exception 'Cannot enforce E.164 contact constraint: invalid phone_e164 values exist';
  end if;

  if exists (
    select 1
    from public.contacts
    where phone_e164 is not null
    group by tenant_id, phone_e164
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce contact dedupe: duplicate tenant phone values exist';
  end if;
end
$$;

alter table public.contacts
  drop constraint if exists contacts_phone_e164_check;

alter table public.contacts
  add constraint contacts_phone_e164_check
  check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

create unique index if not exists uq_contacts_tenant_phone_e164
  on public.contacts(tenant_id, phone_e164)
  where phone_e164 is not null;
