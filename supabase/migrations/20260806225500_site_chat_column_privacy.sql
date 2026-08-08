-- Tenant dashboards need session metadata, not authentication material or
-- pseudonymous network identifiers. Use column-level privileges in addition to RLS.
revoke select on public.site_chat_sessions from authenticated;

grant select (
  id,
  tenant_id,
  chatbot_id,
  origin,
  contact_id,
  lead_id,
  status,
  consent_at,
  expires_at,
  last_seen_at,
  created_at
) on public.site_chat_sessions to authenticated;
