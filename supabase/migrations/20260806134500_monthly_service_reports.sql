create or replace function public.generate_monthly_service_reports(
  p_reference_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  period_start timestamptz := date_trunc('month', p_reference_date::timestamptz) - interval '1 month';
  period_end timestamptz := date_trunc('month', p_reference_date::timestamptz);
  report_month text := to_char(period_start, 'YYYY-MM');
  tenant_row record;
  requests_received integer;
  closed_workflows integer;
  handoffs integer;
  followups integer;
  calls_tracked integer;
  calls_connected integer;
  structured_outcomes integer;
  appointments_created integer;
  appointments_cancelled integer;
  appointments_rescheduled integer;
  messages_tracked integer;
  failed_messages integer;
  failed_reminders integer;
  provider_errors integer;
  knowledge_changes integer;
  configuration_changes integer;
  tests_recorded integer;
  handoff_rate numeric;
  next_actions jsonb;
  generated_count integer := 0;
begin
  for tenant_row in
    select distinct t.id, t.name
    from public.tenants t
    join public.subscriptions s on s.tenant_id = t.id
    where s.status = 'active'
  loop
    if exists (
      select 1
      from public.audit_log al
      where al.tenant_id = tenant_row.id
        and al.action = 'service_report.monthly_generated'
        and al.payload_json ->> 'report_month' = report_month
    ) then
      continue;
    end if;

    select count(*)::integer,
           count(*) filter (where status in ('APPOINTMENT_SET', 'LOST', 'DO_NOT_CONTACT'))::integer,
           count(*) filter (where handoff_status = 'HUMAN')::integer,
           count(*) filter (
             where next_action_at is not null
               and status not in ('APPOINTMENT_SET', 'LOST', 'DO_NOT_CONTACT')
           )::integer
      into requests_received, closed_workflows, handoffs, followups
    from public.leads
    where tenant_id = tenant_row.id
      and created_at >= period_start
      and created_at < period_end;

    select count(*)::integer,
           count(*) filter (where coalesce(connected_seconds, 0) > 0)::integer,
           count(*) filter (
             where outcome_json is not null
               and outcome_json <> '{}'::jsonb
           )::integer
      into calls_tracked, calls_connected, structured_outcomes
    from public.call_logs
    where tenant_id = tenant_row.id
      and created_at >= period_start
      and created_at < period_end;

    select count(*)::integer,
           count(*) filter (where status::text = 'cancelled')::integer
      into appointments_created, appointments_cancelled
    from public.appointments
    where tenant_id = tenant_row.id
      and created_at >= period_start
      and created_at < period_end;

    select count(*) filter (
      where old_appointment_id is not null
        and new_appointment_id is not null
    )::integer
      into appointments_rescheduled
    from public.appointments_history
    where tenant_id = tenant_row.id
      and created_at >= period_start
      and created_at < period_end;

    select count(*)::integer,
           count(*) filter (where status::text in ('failed', 'rejected', 'undelivered'))::integer
      into messages_tracked, failed_messages
    from public.message_logs
    where tenant_id = tenant_row.id
      and created_at >= period_start
      and created_at < period_end;

    select count(*) filter (
      where status = 'failed' or attempts >= 3
    )::integer
      into failed_reminders
    from public.reminders
    where tenant_id = tenant_row.id
      and created_at >= period_start
      and created_at < period_end;

    select count(*) filter (
             where action ~* '(failed|failure|error|unavailable)'
           )::integer,
           count(*) filter (
             where action like 'knowledge.%'
           )::integer,
           count(*) filter (
             where action ~* '(settings|prompt|integration|onboarding|handoff|pipeline|availability)'
           )::integer,
           count(*) filter (
             where action ~* '(test|verification|check)'
           )::integer
      into provider_errors, knowledge_changes, configuration_changes, tests_recorded
    from public.audit_log
    where tenant_id = tenant_row.id
      and created_at >= period_start
      and created_at < period_end
      and action <> 'service_report.monthly_generated';

    handoff_rate := case
      when requests_received > 0 then round((handoffs::numeric / requests_received::numeric) * 100, 1)
      else null
    end;

    next_actions := '[]'::jsonb;
    if provider_errors > 0 or failed_messages > 0 or failed_reminders > 0 then
      next_actions := next_actions || jsonb_build_array('Rivedere errori provider, messaggi e promemoria nel Centro qualità');
    end if;
    if calls_connected > 0 and structured_outcomes < calls_connected then
      next_actions := next_actions || jsonb_build_array('Aumentare la copertura degli esiti strutturati delle chiamate');
    end if;
    if handoffs > 0 then
      next_actions := next_actions || jsonb_build_array('Analizzare i passaggi umani per aggiornare regole e knowledge base');
    end if;
    if knowledge_changes = 0 then
      next_actions := next_actions || jsonb_build_array('Verificare che le fonti approvate siano ancora aggiornate');
    end if;
    if jsonb_array_length(next_actions) = 0 then
      next_actions := jsonb_build_array('Confermare obiettivi e soglie operative del mese successivo');
    end if;

    insert into public.audit_log (
      tenant_id,
      action,
      payload_json
    ) values (
      tenant_row.id,
      'service_report.monthly_generated',
      jsonb_build_object(
        'report_month', report_month,
        'period_start', period_start,
        'period_end', period_end,
        'tenant_name', tenant_row.name,
        'generated_at', now(),
        'definitions', jsonb_build_object(
          'requests_received', 'Lead creati nel periodo',
          'closed_workflows', 'Lead in APPOINTMENT_SET, LOST o DO_NOT_CONTACT',
          'handoffs', 'Lead ancora assegnati a gestione umana',
          'structured_outcomes', 'Chiamate con outcome_json non vuoto'
        ),
        'results', jsonb_build_object(
          'requests_received', requests_received,
          'closed_workflows', closed_workflows,
          'calls_tracked', calls_tracked,
          'calls_connected', calls_connected,
          'appointments_created', appointments_created,
          'appointments_cancelled', appointments_cancelled,
          'appointments_rescheduled', appointments_rescheduled,
          'messages_tracked', messages_tracked,
          'active_followups', followups
        ),
        'quality', jsonb_build_object(
          'human_handoffs', handoffs,
          'human_handoff_rate_percent', handoff_rate,
          'structured_outcomes', structured_outcomes,
          'provider_error_events', provider_errors,
          'failed_messages', failed_messages,
          'failed_reminders', failed_reminders
        ),
        'activities', jsonb_build_object(
          'knowledge_events', knowledge_changes,
          'configuration_events', configuration_changes,
          'test_events', tests_recorded
        ),
        'next_month_plan', next_actions
      )
    );

    generated_count := generated_count + 1;
  end loop;

  return generated_count;
end;
$$;

revoke all on function public.generate_monthly_service_reports(date) from public;
grant execute on function public.generate_monthly_service_reports(date) to service_role;

-- Generate reports for the previous calendar month at 06:30 Europe/Rome-compatible UTC window.
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'generate-monthly-service-reports' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'generate-monthly-service-reports',
    '30 5 1 * *',
    'select public.generate_monthly_service_reports(current_date);'
  );
end;
$$;
