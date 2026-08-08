-- Restrict privileged SECURITY DEFINER functions that are not part of the Fase 1 client API.
-- RLS helper functions intentionally remain executable by authenticated because policies call them.

revoke execute on function public.enforce_knowledge_governance() from public, anon, authenticated;
grant execute on function public.enforce_knowledge_governance() to service_role;

revoke execute on function public.expire_knowledge_approvals() from public, anon, authenticated;
grant execute on function public.expire_knowledge_approvals() to service_role;

revoke execute on function public.generate_monthly_service_reports(date) from public, anon, authenticated;
grant execute on function public.generate_monthly_service_reports(date) to service_role;

-- Fase 1 has no public referral/self-service signup flow.
revoke execute on function public.lookup_referral_code(text) from public, anon, authenticated;
grant execute on function public.lookup_referral_code(text) to service_role;

-- Number compliance may be consumed by authenticated readiness views/UI, but never anonymously.
revoke execute on function public.is_compliant_voice_number(uuid, text) from public, anon;
grant execute on function public.is_compliant_voice_number(uuid, text) to authenticated, service_role;

-- Knowledge governance mutation is admin-authenticated only, never anonymous.
revoke execute on function public.set_knowledge_source_governance(uuid, text, timestamptz, text, text) from public, anon;
grant execute on function public.set_knowledge_source_governance(uuid, text, timestamptz, text, text) to authenticated, service_role;
