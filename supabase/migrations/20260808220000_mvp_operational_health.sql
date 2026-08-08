-- Minimal MVP operational health aggregation.
-- Vercel remains the source for frontend/runtime 5xx. Supabase Edge logs remain
-- the source for uncaught Edge Function crashes. This RPC aggregates durable
-- database signals for provider and queue health without exposing tenant data.

create or replace function public.get_mvp_operational_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  is_service_role boolean := coalesce(auth.jwt()->>'role', '') = 'service_role';
  caller uuid := auth.uid();
  heartbeat public.worker_heartbeats%rowtype;
  queue_state text;
  twilio_failed integer;
  openai_failed integer;
  google_failed integer;
  queue_failed integer;
begin
  if not is_service_role and not public.is_platform_admin(caller) then
    raise exception 'Platform admin or service role required' using errcode = '42501';
  end if;

  select * into heartbeat
  from public.worker_heartbeats
  where worker_name = 'call_queue';

  queue_state := case
    when heartbeat.worker_name is null then 'not_started'
    when heartbeat.status = 'error' then 'error'
    when heartbeat.last_success_at is null then 'not_started'
    when heartbeat.last_success_at < now() - interval '5 minutes' then 'stale'
    else 'ok'
  end;

  select count(*)::integer into twilio_failed
  from public.provider_events
  where provider = 'twilio'
    and status = 'failed'
    and created_at >= now() - interval '15 minutes';

  select count(*)::integer into openai_failed
  from public.audit_log
  where action = 'site_chat.provider_failed'
    and created_at >= now() - interval '15 minutes';

  select count(*)::integer into google_failed
  from public.audit_log
  where action in (
    'google_oauth.token_exchange_failed',
    'google_oauth.insufficient_scope',
    'google_oauth.refresh_token_missing',
    'google_oauth.refresh_failed'
  )
    and created_at >= now() - interval '15 minutes';

  select count(*)::integer into queue_failed
  from public.call_queue
  where status = 'failed'
    and updated_at >= now() - interval '15 minutes';

  return jsonb_build_object(
    'checked_at', now(),
    'queue_worker', jsonb_build_object(
      'status', queue_state,
      'last_success_at', heartbeat.last_success_at,
      'last_error', heartbeat.last_error
    ),
    'signals_15m', jsonb_build_object(
      'twilio_failed_events', twilio_failed,
      'openai_failed_requests', openai_failed,
      'google_calendar_failures', google_failed,
      'queue_failed_items', queue_failed
    )
  );
end;
$$;

revoke all on function public.get_mvp_operational_health() from public, anon, authenticated;
grant execute on function public.get_mvp_operational_health() to service_role;
