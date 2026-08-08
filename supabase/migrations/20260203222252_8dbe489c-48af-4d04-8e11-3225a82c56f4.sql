-- Add caller_id_e164 column to settings for verified caller ID
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS caller_id_e164 TEXT NULL;

-- Add comment explaining usage
COMMENT ON COLUMN public.settings.caller_id_e164 IS 'Verified caller ID in E.164 format (e.g. +39123456789). Used as From number for outbound calls. If null, falls back to tenant_phone_numbers.';