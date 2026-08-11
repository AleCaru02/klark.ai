-- The composite FK enforces both contact existence and tenant isolation.
-- The older single-column FK is therefore redundant and makes PostgREST expose
-- two relationships between appointments and contacts, causing PGRST201 on
-- embedded contact reads in Calendar.
alter table public.appointments
  drop constraint if exists appointments_contact_id_fkey;
