-- Add sync_token column to google_tokens for incremental sync
ALTER TABLE public.google_tokens 
ADD COLUMN IF NOT EXISTS sync_token text;

-- Add comment for documentation
COMMENT ON COLUMN public.google_tokens.sync_token IS 'Google Calendar sync token for incremental sync';