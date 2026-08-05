-- Applied directly to the Lovable/Supabase database on 2026-08-05.
-- Additive database hardening. Edge workers must be updated before secure cron jobs are recreated.

BEGIN;

-- Broken jobs used an anon key and generated 401 responses every minute.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobid IN (1,2);

CREATE TABLE IF NOT EXISTS public.oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE,
  provider text NOT NULL CHECK (provider IN ('google','facebook','whatsapp')),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  CONSTRAINT oauth_states_valid_expiry CHECK (expires_at>created_at)
);
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oauth_states FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.oauth_states TO service_role;
CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry_unused ON public.oauth_states(expires_at) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS public.provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_event_id text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processing','processed','duplicate','failed','ignored')),
  payload_digest text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
  locked_at timestamptz,
  worker_id uuid,
  processed_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,external_event_id)
);
ALTER TABLE public.provider_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provider_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.provider_events TO service_role;
CREATE INDEX IF NOT EXISTS idx_provider_events_work ON public.provider_events(provider,status,created_at);

CREATE TABLE IF NOT EXISTS public.google_watch_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id text NOT NULL UNIQUE,
  resource_id text,
  calendar_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.google_watch_channels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_watch_channels FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_watch_channels TO service_role;
CREATE INDEX IF NOT EXISTS idx_google_watch_renewal ON public.google_watch_channels(expires_at) WHERE active;

ALTER TABLE public.call_queue ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE public.call_queue ADD COLUMN IF NOT EXISTS worker_id uuid;
ALTER TABLE public.call_queue ADD COLUMN IF NOT EXISTS last_error_code text;
ALTER TABLE public.call_queue ADD COLUMN IF NOT EXISTS retry_after timestamptz;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS worker_id uuid;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS last_error_code text;

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Rome';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ai_data_processing_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS allowed_origins text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS external_sync_status text NOT NULL DEFAULT 'not_started';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS external_sync_error_code text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_tenant_idempotency ON public.appointments(tenant_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_google_event ON public.appointments(tenant_id,google_calendar_id,calendar_event_id) WHERE calendar_event_id IS NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='appointments_valid_time_range') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_valid_time_range CHECK (end_at>start_at) NOT VALID;
    ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_valid_time_range;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_call_logs_twilio_sid ON public.call_logs(twilio_call_sid) WHERE twilio_call_sid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_status_once ON public.whatsapp_message_statuses(message_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_codes_lower ON public.referral_codes(lower(code));
CREATE UNIQUE INDEX IF NOT EXISTS uq_call_queue_active_contact ON public.call_queue(tenant_id,contact_id)
  WHERE status IN ('pending','no_answer','calling','processing');
CREATE UNIQUE INDEX IF NOT EXISTS uq_reminder_semantic ON public.reminders(tenant_id,appointment_id,channel,reminder_type,when_ts)
  WHERE appointment_id IS NOT NULL;

DROP POLICY IF EXISTS "Anyone can lookup referral code" ON public.referral_codes;
CREATE OR REPLACE FUNCTION public.lookup_referral_code(input_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE normalized text:=lower(trim(coalesce(input_code,'')));
BEGIN
  IF length(normalized)<3 OR length(normalized)>64 OR normalized!~'^[a-z0-9_-]+$' THEN
    RETURN jsonb_build_object('valid',false);
  END IF;
  RETURN jsonb_build_object('valid',EXISTS(SELECT 1 FROM public.referral_codes rc WHERE lower(rc.code)=normalized));
END; $$;
REVOKE ALL ON FUNCTION public.lookup_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_referral_code(text) TO anon,authenticated;

DROP POLICY IF EXISTS "Authenticated can view null-tenant audit_log" ON public.audit_log;

CREATE OR REPLACE FUNCTION public.claim_call_queue_batch(p_limit integer DEFAULT 10,p_worker_id uuid DEFAULT gen_random_uuid())
RETURNS SETOF public.call_queue LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RETURN QUERY WITH picked AS (
  SELECT q.id FROM public.call_queue q
   WHERE q.status IN ('pending','no_answer')
     AND coalesce(q.retry_after,q.next_attempt_at,now())<=now()
     AND (q.locked_at IS NULL OR q.locked_at<now()-interval '10 minutes')
   ORDER BY q.priority DESC NULLS LAST,q.created_at FOR UPDATE SKIP LOCKED
   LIMIT greatest(1,least(coalesce(p_limit,10),100))
 ) UPDATE public.call_queue q SET status='processing',locked_at=now(),worker_id=p_worker_id,updated_at=now()
   FROM picked WHERE q.id=picked.id RETURNING q.*;
END; $$;
REVOKE ALL ON FUNCTION public.claim_call_queue_batch(integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_call_queue_batch(integer,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_reminder_batch(p_limit integer DEFAULT 100,p_worker_id uuid DEFAULT gen_random_uuid())
RETURNS SETOF public.reminders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RETURN QUERY WITH picked AS (
  SELECT r.id FROM public.reminders r WHERE r.status='pending' AND r.when_ts<=now()
    AND (r.locked_at IS NULL OR r.locked_at<now()-interval '10 minutes')
  ORDER BY r.when_ts,r.created_at FOR UPDATE SKIP LOCKED
  LIMIT greatest(1,least(coalesce(p_limit,100),500))
 ) UPDATE public.reminders r SET status='processing',locked_at=now(),worker_id=p_worker_id,attempts=r.attempts+1
   FROM picked WHERE r.id=picked.id RETURNING r.*;
END; $$;
REVOKE ALL ON FUNCTION public.claim_reminder_batch(integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reminder_batch(integer,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.increment_call_queue_attempt(p_queue_id uuid,p_tenant_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count integer;
BEGIN
 UPDATE public.call_queue SET attempt_count=coalesce(attempt_count,0)+1,last_attempt_at=now(),updated_at=now()
 WHERE id=p_queue_id AND tenant_id=p_tenant_id RETURNING attempt_count INTO v_count;
 IF v_count IS NULL THEN RAISE EXCEPTION 'queue item not found'; END IF;
 RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.increment_call_queue_attempt(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.increment_call_queue_attempt(uuid,uuid) TO service_role;

COMMIT;
