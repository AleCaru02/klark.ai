-- Applied directly to the Lovable/Supabase database on 2026-08-05.
-- Fixes privileged RPC exposure, cross-tenant UPDATE reassignment and secret storage.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tenant_secrets (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  facebook_webhook_secret text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tenant_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_secrets FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.tenant_secrets TO service_role;

INSERT INTO public.tenant_secrets(tenant_id,facebook_webhook_secret)
SELECT tenant_id,facebook_webhook_secret FROM public.settings
WHERE facebook_webhook_secret IS NOT NULL AND length(facebook_webhook_secret)>0
ON CONFLICT(tenant_id) DO UPDATE SET facebook_webhook_secret=excluded.facebook_webhook_secret,updated_at=now();
UPDATE public.settings SET facebook_webhook_secret=NULL WHERE facebook_webhook_secret IS NOT NULL;

CREATE OR REPLACE FUNCTION public.block_client_secret_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF new.facebook_webhook_secret IS NOT NULL AND coalesce(auth.jwt()->>'role','')<>'service_role' THEN
    RAISE EXCEPTION 'secret fields must be written by a server function';
  END IF;
  RETURN new;
END; $$;
DROP TRIGGER IF EXISTS trg_block_client_secret_writes ON public.settings;
CREATE TRIGGER trg_block_client_secret_writes
BEFORE INSERT OR UPDATE OF facebook_webhook_secret ON public.settings
FOR EACH ROW EXECUTE FUNCTION public.block_client_secret_writes();
REVOKE ALL ON FUNCTION public.block_client_secret_writes() FROM PUBLIC,anon,authenticated;

-- Add a new-row predicate to all UPDATE policies that previously had only USING.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname,tablename,policyname,qual FROM pg_policies
    WHERE schemaname='public' AND cmd='UPDATE' AND with_check IS NULL AND qual IS NOT NULL
  LOOP
    EXECUTE format('alter policy %I on %I.%I with check (%s)',r.policyname,r.schemaname,r.tablename,r.qual);
  END LOOP;
END $$;
ALTER POLICY "Customers can manage own tenant whatsapp_templates" ON public.whatsapp_templates
WITH CHECK (user_belongs_to_tenant(auth.uid(),tenant_id));

CREATE OR REPLACE FUNCTION public.get_user_profile_tenant_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.tenant_id FROM public.profiles p
 WHERE p.id=_user_id AND (_user_id=auth.uid() OR coalesce(auth.jwt()->>'role','')='service_role') LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT m.tenant_id FROM public.memberships m
 WHERE m.user_id=_user_id AND (_user_id=auth.uid() OR coalesce(auth.jwt()->>'role','')='service_role') LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.has_membership_role(_user_id uuid,_role public.membership_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN _user_id IS NULL THEN false
  WHEN _user_id<>auth.uid() AND coalesce(auth.jwt()->>'role','')<>'service_role' THEN false
  ELSE EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=_user_id AND m.role=_role) END
$$;
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_user_id uuid,_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN _user_id IS NULL OR _tenant_id IS NULL THEN false
  WHEN _user_id<>auth.uid() AND coalesce(auth.jwt()->>'role','')<>'service_role' THEN false
  ELSE EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=_user_id AND m.tenant_id=_tenant_id) END
$$;
CREATE OR REPLACE FUNCTION public.user_has_profile_in_tenant(_user_id uuid,_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN _user_id IS NULL OR _tenant_id IS NULL THEN false
  WHEN _user_id<>auth.uid() AND coalesce(auth.jwt()->>'role','')<>'service_role' THEN false
  ELSE EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=_user_id AND p.tenant_id=_tenant_id) END
$$;

REVOKE ALL ON FUNCTION public.get_user_profile_tenant_id(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_user_tenant_id(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.has_membership_role(uuid,public.membership_role) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.user_belongs_to_tenant(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.user_has_profile_in_tenant(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_user_profile_tenant_id(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.has_membership_role(uuid,public.membership_role) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_tenant(uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.user_has_profile_in_tenant(uuid,uuid) TO authenticated,service_role;

REVOKE ALL ON FUNCTION public.fix_contacts_without_stage() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fix_contacts_without_stage() TO service_role;

COMMIT;
