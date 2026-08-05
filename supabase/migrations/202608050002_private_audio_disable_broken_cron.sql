-- REVIEW BEFORE APPLYING.
-- Questa migrazione rende privati gli audio e interrompe i cron che oggi generano 401.

begin;

update storage.buckets
set public = false
where id = 'voice-audio';

drop policy if exists "Public read access for voice audio" on storage.objects;
drop policy if exists "Service role can delete voice audio" on storage.objects;
drop policy if exists "Service role can upload voice audio" on storage.objects;

-- La service role bypassa RLS: non servono policy client sul bucket voice-audio.
-- L'app dovrà usare signed URL brevi generati server-side.

-- Evita duplicazione del medesimo log Twilio.
create unique index if not exists call_logs_twilio_call_sid_unique
on public.call_logs (twilio_call_sid)
where twilio_call_sid is not null;

-- I job esistenti usano una chiave anon e ricevono 401 ogni minuto.
-- Vengono disattivati finché non saranno ricreati tramite Vault/secret server-side.
do $$
declare
  target_job record;
begin
  for target_job in
    select jobid
    from cron.job
    where command like '%/functions/v1/process-call-queue%'
       or command like '%/functions/v1/process-reminders%'
  loop
    perform cron.unschedule(target_job.jobid);
  end loop;
end
$$;

commit;