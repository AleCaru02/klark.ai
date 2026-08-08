-- Applied directly to the Lovable/Supabase database on 2026-08-05.
-- Separates platform administration from tenant membership and enforces tenant-consistent relationships.

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.platform_admins TO service_role;
INSERT INTO public.platform_admins(user_id)
SELECT DISTINCT user_id FROM public.memberships WHERE role='admin'::public.membership_role
ON CONFLICT(user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_membership_role(_user_id uuid,_role public.membership_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE
  WHEN _user_id IS NULL THEN false
  WHEN _user_id<>auth.uid() AND coalesce(auth.jwt()->>'role','')<>'service_role' THEN false
  WHEN _role='admin'::public.membership_role THEN EXISTS(SELECT 1 FROM public.platform_admins pa WHERE pa.user_id=_user_id)
  ELSE EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=_user_id AND m.role=_role)
 END
$$;
REVOKE ALL ON FUNCTION public.has_membership_role(uuid,public.membership_role) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_membership_role(uuid,public.membership_role) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.protect_profile_authorization_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF (new.tenant_id IS DISTINCT FROM old.tenant_id OR new.role IS DISTINCT FROM old.role)
    AND coalesce(auth.jwt()->>'role','')<>'service_role' THEN
   RAISE EXCEPTION 'tenant and role are server-managed fields';
 END IF;
 RETURN new;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_profile_authorization_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_authorization_fields
BEFORE UPDATE OF tenant_id,role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_authorization_fields();
REVOKE ALL ON FUNCTION public.protect_profile_authorization_fields() FROM PUBLIC,anon,authenticated;
ALTER POLICY "Users can update own profile" ON public.profiles
USING(id=auth.uid()) WITH CHECK(id=auth.uid() AND user_belongs_to_tenant(auth.uid(),tenant_id));

CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_tenant_id_id ON public.contacts(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_tenant_id_id ON public.leads(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_tenant_id_id ON public.appointments(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_stages_tenant_id_id ON public.stages(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pipelines_tenant_id_id ON public.pipelines(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_call_logs_tenant_id_id ON public.call_logs(tenant_id,id);

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='appointments_tenant_contact_fkey') THEN
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_tenant_contact_fkey FOREIGN KEY(tenant_id,contact_id) REFERENCES public.contacts(tenant_id,id) ON DELETE SET NULL NOT VALID;
  ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_tenant_contact_fkey;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='call_queue_tenant_contact_fkey') THEN
  ALTER TABLE public.call_queue ADD CONSTRAINT call_queue_tenant_contact_fkey FOREIGN KEY(tenant_id,contact_id) REFERENCES public.contacts(tenant_id,id) ON DELETE CASCADE NOT VALID;
  ALTER TABLE public.call_queue VALIDATE CONSTRAINT call_queue_tenant_contact_fkey;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='call_logs_tenant_contact_fkey') THEN
  ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_tenant_contact_fkey FOREIGN KEY(tenant_id,contact_id) REFERENCES public.contacts(tenant_id,id) ON DELETE SET NULL NOT VALID;
  ALTER TABLE public.call_logs VALIDATE CONSTRAINT call_logs_tenant_contact_fkey;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='reminders_tenant_contact_fkey') THEN
  ALTER TABLE public.reminders ADD CONSTRAINT reminders_tenant_contact_fkey FOREIGN KEY(tenant_id,contact_id) REFERENCES public.contacts(tenant_id,id) ON DELETE CASCADE NOT VALID;
  ALTER TABLE public.reminders VALIDATE CONSTRAINT reminders_tenant_contact_fkey;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='reminders_tenant_appointment_fkey') THEN
  ALTER TABLE public.reminders ADD CONSTRAINT reminders_tenant_appointment_fkey FOREIGN KEY(tenant_id,appointment_id) REFERENCES public.appointments(tenant_id,id) ON DELETE CASCADE NOT VALID;
  ALTER TABLE public.reminders VALIDATE CONSTRAINT reminders_tenant_appointment_fkey;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='contact_stages_tenant_contact_fkey') THEN
  ALTER TABLE public.contact_stages ADD CONSTRAINT contact_stages_tenant_contact_fkey FOREIGN KEY(tenant_id,contact_id) REFERENCES public.contacts(tenant_id,id) ON DELETE CASCADE NOT VALID;
  ALTER TABLE public.contact_stages VALIDATE CONSTRAINT contact_stages_tenant_contact_fkey;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='contact_stages_tenant_stage_fkey') THEN
  ALTER TABLE public.contact_stages ADD CONSTRAINT contact_stages_tenant_stage_fkey FOREIGN KEY(tenant_id,stage_id) REFERENCES public.stages(tenant_id,id) ON DELETE CASCADE NOT VALID;
  ALTER TABLE public.contact_stages VALIDATE CONSTRAINT contact_stages_tenant_stage_fkey;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='lead_notes_tenant_contact_fkey') THEN
  ALTER TABLE public.lead_notes ADD CONSTRAINT lead_notes_tenant_contact_fkey FOREIGN KEY(tenant_id,contact_id) REFERENCES public.contacts(tenant_id,id) ON DELETE CASCADE NOT VALID;
  ALTER TABLE public.lead_notes VALIDATE CONSTRAINT lead_notes_tenant_contact_fkey;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='lead_form_answers_tenant_contact_fkey') THEN
  ALTER TABLE public.lead_form_answers ADD CONSTRAINT lead_form_answers_tenant_contact_fkey FOREIGN KEY(tenant_id,contact_id) REFERENCES public.contacts(tenant_id,id) ON DELETE CASCADE NOT VALID;
  ALTER TABLE public.lead_form_answers VALIDATE CONSTRAINT lead_form_answers_tenant_contact_fkey;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='whatsapp_messages_tenant_contact_fkey') THEN
  ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_tenant_contact_fkey FOREIGN KEY(tenant_id,contact_id) REFERENCES public.contacts(tenant_id,id) ON DELETE SET NULL NOT VALID;
  ALTER TABLE public.whatsapp_messages VALIDATE CONSTRAINT whatsapp_messages_tenant_contact_fkey;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='whatsapp_messages_tenant_appointment_fkey') THEN
  ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_tenant_appointment_fkey FOREIGN KEY(tenant_id,appointment_id) REFERENCES public.appointments(tenant_id,id) ON DELETE SET NULL NOT VALID;
  ALTER TABLE public.whatsapp_messages VALIDATE CONSTRAINT whatsapp_messages_tenant_appointment_fkey;
 END IF;
END $$;

COMMIT;
