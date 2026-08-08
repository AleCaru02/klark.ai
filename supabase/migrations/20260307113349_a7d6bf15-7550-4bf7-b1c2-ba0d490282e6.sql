
-- Add meeting_provider and meeting_id to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS meeting_provider text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS meeting_id text DEFAULT NULL;

-- Add default_meeting_provider to settings
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS default_meeting_provider text DEFAULT NULL;

COMMENT ON COLUMN public.appointments.meeting_provider IS 'google_meet or zoom';
COMMENT ON COLUMN public.appointments.meeting_id IS 'External meeting ID (e.g. Zoom meeting ID)';
COMMENT ON COLUMN public.settings.default_meeting_provider IS 'Default meeting provider: google_meet or zoom';
