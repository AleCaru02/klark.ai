-- 1) Funzione stato integrazioni (nessun token esposto)
CREATE OR REPLACE FUNCTION public.get_integration_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tenant uuid;
  v_google jsonb := jsonb_build_object('connected', false);
  v_facebook jsonb := jsonb_build_object('connected', false);
  v_whatsapp jsonb := jsonb_build_object('connected', false);
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT tenant_id INTO v_tenant FROM public.memberships WHERE user_id = v_user LIMIT 1;
  IF v_tenant IS NULL THEN
    SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = v_user LIMIT 1;
  END IF;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('tenant_id', NULL, 'google', v_google, 'facebook', v_facebook, 'whatsapp', v_whatsapp);
  END IF;

  SELECT jsonb_build_object(
    'connected', true,
    'calendar_id', g.calendar_id,
    'scope', g.scope,
    'token_expires_at', g.token_expires_at,
    'expired', (g.token_expires_at <= now()),
    'updated_at', g.updated_at
  ) INTO v_google
  FROM public.google_tokens g WHERE g.tenant_id = v_tenant;

  SELECT jsonb_build_object(
    'connected', true,
    'page_id', CASE WHEN f.page_id = '__pending__' THEN NULL ELSE f.page_id END,
    'pending_page_selection', (f.page_id = '__pending__'),
    'token_expires_at', f.token_expires_at,
    'expired', (f.token_expires_at IS NOT NULL AND f.token_expires_at <= now()),
    'updated_at', f.updated_at
  ) INTO v_facebook
  FROM public.facebook_integrations f WHERE f.tenant_id = v_tenant;

  SELECT jsonb_build_object(
    'connected', true,
    'waba_id', w.waba_id,
    'phone_number_id', w.phone_number_id,
    'display_phone_number', w.display_phone_number,
    'verified_name', w.verified_name,
    'token_expires_at', w.token_expires_at,
    'expired', (w.token_expires_at IS NOT NULL AND w.token_expires_at <= now()),
    'created_at', w.created_at,
    'updated_at', w.updated_at
  ) INTO v_whatsapp
  FROM public.whatsapp_integrations w WHERE w.tenant_id = v_tenant;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant,
    'google', COALESCE(v_google, jsonb_build_object('connected', false)),
    'facebook', COALESCE(v_facebook, jsonb_build_object('connected', false)),
    'whatsapp', COALESCE(v_whatsapp, jsonb_build_object('connected', false))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_integration_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_integration_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_integration_status() TO service_role;

-- 2) Rimozione accesso client alle tabelle con token (dati conservati)
DROP POLICY IF EXISTS "Admins can do everything on google_tokens" ON public.google_tokens;
DROP POLICY IF EXISTS "Customers can view own tenant google_tokens" ON public.google_tokens;

DROP POLICY IF EXISTS "Admins can do everything on facebook_integrations" ON public.facebook_integrations;
DROP POLICY IF EXISTS "Customers can view own tenant facebook_integrations" ON public.facebook_integrations;

DROP POLICY IF EXISTS "Admins can do everything on whatsapp_integrations" ON public.whatsapp_integrations;
DROP POLICY IF EXISTS "Customers can view own tenant whatsapp_integrations" ON public.whatsapp_integrations;
DROP POLICY IF EXISTS "Customers can insert own tenant whatsapp_integrations" ON public.whatsapp_integrations;
DROP POLICY IF EXISTS "Customers can update own tenant whatsapp_integrations" ON public.whatsapp_integrations;
DROP POLICY IF EXISTS "Customers can delete own tenant whatsapp_integrations" ON public.whatsapp_integrations;

ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_integrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.google_tokens FROM anon, authenticated;
REVOKE ALL ON public.facebook_integrations FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_integrations FROM anon, authenticated;

GRANT ALL ON public.google_tokens TO service_role;
GRANT ALL ON public.facebook_integrations TO service_role;
GRANT ALL ON public.whatsapp_integrations TO service_role;

-- 3) Storage: audio chiamate non più pubblico
DROP POLICY IF EXISTS "Public read access for voice audio" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload voice audio" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete voice audio" ON storage.objects;