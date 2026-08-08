
-- =====================================================
-- SECURITY FIX: Tighten RLS policies
-- Split overly-broad FOR ALL into granular per-operation policies
-- Remove customer write access from sensitive integration tables
-- =====================================================

-- 1. google_tokens: Remove customer write access (OAuth handled by edge functions with service role)
DROP POLICY IF EXISTS "Customers can delete own tenant google_tokens" ON public.google_tokens;
DROP POLICY IF EXISTS "Customers can insert own tenant google_tokens" ON public.google_tokens;
DROP POLICY IF EXISTS "Customers can update own tenant google_tokens" ON public.google_tokens;
-- Keep: "Customers can view own tenant google_tokens" for SELECT

-- 2. contacts: Split FOR ALL into granular policies (keep full CRUD for CRM workflow)
DROP POLICY IF EXISTS "Customers can manage own tenant contacts" ON public.contacts;
CREATE POLICY "Customers can view own tenant contacts" ON public.contacts FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant contacts" ON public.contacts FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can update own tenant contacts" ON public.contacts FOR UPDATE USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can delete own tenant contacts" ON public.contacts FOR DELETE USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 3. appointments: Split FOR ALL, remove customer DELETE (use status=cancelled instead)
DROP POLICY IF EXISTS "Customers can manage own tenant appointments" ON public.appointments;
CREATE POLICY "Customers can view own tenant appointments" ON public.appointments FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant appointments" ON public.appointments FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can update own tenant appointments" ON public.appointments FOR UPDATE USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 4. calendar_links: Split FOR ALL, remove customer DELETE (system-managed)
DROP POLICY IF EXISTS "Customers can manage own tenant calendar_links" ON public.calendar_links;
CREATE POLICY "Customers can view own tenant calendar_links" ON public.calendar_links FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant calendar_links" ON public.calendar_links FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can update own tenant calendar_links" ON public.calendar_links FOR UPDATE USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 5. call_queue: Split FOR ALL (keep DELETE since customer hook uses removeFromQueue)
DROP POLICY IF EXISTS "Customers can manage own tenant call_queue" ON public.call_queue;
CREATE POLICY "Customers can view own tenant call_queue" ON public.call_queue FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant call_queue" ON public.call_queue FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can update own tenant call_queue" ON public.call_queue FOR UPDATE USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can delete own tenant call_queue" ON public.call_queue FOR DELETE USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 6. stages: Split FOR ALL, remove customer DELETE (CRM structure protection)
DROP POLICY IF EXISTS "Customers can manage own tenant stages" ON public.stages;
CREATE POLICY "Customers can view own tenant stages" ON public.stages FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant stages" ON public.stages FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can update own tenant stages" ON public.stages FOR UPDATE USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 7. pipelines: Split FOR ALL, remove customer DELETE (CRM structure protection)
DROP POLICY IF EXISTS "Customers can manage own tenant pipelines" ON public.pipelines;
CREATE POLICY "Customers can view own tenant pipelines" ON public.pipelines FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant pipelines" ON public.pipelines FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can update own tenant pipelines" ON public.pipelines FOR UPDATE USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 8. contact_sources: Split FOR ALL (keep full CRUD for CRM)
DROP POLICY IF EXISTS "Customers can manage own tenant contact_sources" ON public.contact_sources;
CREATE POLICY "Customers can view own tenant contact_sources" ON public.contact_sources FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant contact_sources" ON public.contact_sources FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can update own tenant contact_sources" ON public.contact_sources FOR UPDATE USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can delete own tenant contact_sources" ON public.contact_sources FOR DELETE USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 9. contact_stages: Split FOR ALL (keep full CRUD for CRM)
DROP POLICY IF EXISTS "Customers can manage own tenant contact_stages" ON public.contact_stages;
CREATE POLICY "Customers can view own tenant contact_stages" ON public.contact_stages FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant contact_stages" ON public.contact_stages FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can update own tenant contact_stages" ON public.contact_stages FOR UPDATE USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can delete own tenant contact_stages" ON public.contact_stages FOR DELETE USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 10. facebook_form_answers: Restrict to SELECT + INSERT only (form data is system-managed, immutable)
DROP POLICY IF EXISTS "Customers can manage own tenant facebook_form_answers" ON public.facebook_form_answers;
CREATE POLICY "Customers can view own tenant facebook_form_answers" ON public.facebook_form_answers FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant facebook_form_answers" ON public.facebook_form_answers FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 11. facebook_form_questions: Restrict to SELECT + INSERT only
DROP POLICY IF EXISTS "Customers can manage own tenant facebook_form_questions" ON public.facebook_form_questions;
CREATE POLICY "Customers can view own tenant facebook_form_questions" ON public.facebook_form_questions FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant facebook_form_questions" ON public.facebook_form_questions FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 12. facebook_form_submissions: Restrict to SELECT + INSERT only
DROP POLICY IF EXISTS "Customers can manage own tenant facebook_form_submissions" ON public.facebook_form_submissions;
CREATE POLICY "Customers can view own tenant facebook_form_submissions" ON public.facebook_form_submissions FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant facebook_form_submissions" ON public.facebook_form_submissions FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 13. facebook_forms: Restrict to SELECT + INSERT + UPDATE (no DELETE of form definitions)
DROP POLICY IF EXISTS "Customers can manage own tenant facebook_forms" ON public.facebook_forms;
CREATE POLICY "Customers can view own tenant facebook_forms" ON public.facebook_forms FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant facebook_forms" ON public.facebook_forms FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can update own tenant facebook_forms" ON public.facebook_forms FOR UPDATE USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 14. lead_call_recaps: Split FOR ALL (keep full CRUD)
DROP POLICY IF EXISTS "Customers can manage own tenant lead_call_recaps" ON public.lead_call_recaps;
CREATE POLICY "Customers can view own tenant lead_call_recaps" ON public.lead_call_recaps FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant lead_call_recaps" ON public.lead_call_recaps FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can update own tenant lead_call_recaps" ON public.lead_call_recaps FOR UPDATE USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can delete own tenant lead_call_recaps" ON public.lead_call_recaps FOR DELETE USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 15. lead_form_answers: Restrict to SELECT + INSERT (form submissions are immutable records)
DROP POLICY IF EXISTS "Customers can manage own tenant lead_form_answers" ON public.lead_form_answers;
CREATE POLICY "Customers can view own tenant lead_form_answers" ON public.lead_form_answers FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant lead_form_answers" ON public.lead_form_answers FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 16. lead_notes: Split FOR ALL (keep full CRUD - users need to manage their notes)
DROP POLICY IF EXISTS "Customers can manage own tenant lead_notes" ON public.lead_notes;
CREATE POLICY "Customers can view own tenant lead_notes" ON public.lead_notes FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant lead_notes" ON public.lead_notes FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can update own tenant lead_notes" ON public.lead_notes FOR UPDATE USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can delete own tenant lead_notes" ON public.lead_notes FOR DELETE USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 17. tenant_knowledge: Split FOR ALL (keep full CRUD - customer manages knowledge base)
DROP POLICY IF EXISTS "Customers can manage own tenant knowledge" ON public.tenant_knowledge;
CREATE POLICY "Customers can view own tenant knowledge" ON public.tenant_knowledge FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can insert own tenant knowledge" ON public.tenant_knowledge FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can update own tenant knowledge" ON public.tenant_knowledge FOR UPDATE USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Customers can delete own tenant knowledge" ON public.tenant_knowledge FOR DELETE USING (user_belongs_to_tenant(auth.uid(), tenant_id));
