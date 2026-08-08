-- Reconcile Data API grants with the authenticated customer app.
-- RLS remains the row-level authorization boundary; anon receives no access
-- to tenant application tables. Provider/OAuth secrets remain server-only.

revoke all on table public.contacts from anon;
revoke all on table public.contact_sources from anon;
revoke all on table public.contact_stages from anon;
revoke all on table public.call_logs from anon;
revoke all on table public.appointments from anon;
revoke all on table public.settings from anon;
revoke all on table public.tenant_knowledge from anon;
revoke all on table public.tenant_phone_numbers from anon;
revoke all on table public.tenant_service_accounts from anon;
revoke all on table public.google_tokens from anon, authenticated;

grant select, insert, update, delete on table public.contacts to authenticated;
grant select, insert, update, delete on table public.contact_sources to authenticated;
grant select, insert, update, delete on table public.contact_stages to authenticated;
grant select, insert on table public.call_logs to authenticated;
grant select, insert, update on table public.appointments to authenticated;
grant select, update on table public.settings to authenticated;
grant select, insert, update, delete on table public.tenant_knowledge to authenticated;
grant select on table public.tenant_phone_numbers to authenticated;
grant select on table public.tenant_service_accounts to authenticated;
