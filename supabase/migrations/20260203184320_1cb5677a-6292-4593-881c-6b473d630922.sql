-- Add production-ready columns to settings table
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS voice_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_number text,
ADD COLUMN IF NOT EXISTS twilio_number_sid text,
ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text,
ADD COLUMN IF NOT EXISTS whatsapp_display_number text,
ADD COLUMN IF NOT EXISTS calendar_enabled boolean DEFAULT false;