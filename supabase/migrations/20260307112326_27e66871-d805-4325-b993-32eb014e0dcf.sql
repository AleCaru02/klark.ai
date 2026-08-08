
-- Add unified voice+WA tracking fields to call_queue
ALTER TABLE public.call_queue
  ADD COLUMN IF NOT EXISTS last_voice_outcome text,
  ADD COLUMN IF NOT EXISTS last_wa_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_wa_outcome text,
  ADD COLUMN IF NOT EXISTS callback_time timestamptz,
  ADD COLUMN IF NOT EXISTS callback_source text,
  ADD COLUMN IF NOT EXISTS next_action_channel text DEFAULT 'voice',
  ADD COLUMN IF NOT EXISTS wa_available boolean DEFAULT true;
