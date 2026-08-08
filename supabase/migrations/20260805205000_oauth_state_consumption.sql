-- OAuth state must be opaque, one-time and consumed atomically by service-role callbacks.

BEGIN;

CREATE OR REPLACE FUNCTION public.consume_oauth_state(
  p_provider text,
  p_state_hash text
)
RETURNS TABLE(
  tenant_id uuid,
  user_id uuid,
  redirect_uri text,
  metadata_json jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.oauth_states state
     SET used_at=now()
   WHERE state.provider=p_provider
     AND state.state_hash=p_state_hash
     AND state.used_at IS NULL
     AND state.expires_at>now()
  RETURNING state.tenant_id,state.user_id,state.redirect_uri,state.metadata_json;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_oauth_state(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_oauth_state(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_expired_oauth_states()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM public.oauth_states
   WHERE expires_at<now()-interval '1 day'
      OR used_at<now()-interval '1 day';
  GET DIAGNOSTICS deleted_count=ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_expired_oauth_states() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_expired_oauth_states() TO service_role;

COMMIT;
