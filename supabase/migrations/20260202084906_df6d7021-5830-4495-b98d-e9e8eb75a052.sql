-- Drop existing constraint and recreate with voice_ai value
ALTER TABLE appointments DROP CONSTRAINT appointments_created_from_check;

ALTER TABLE appointments ADD CONSTRAINT appointments_created_from_check 
CHECK (created_from = ANY (ARRAY['app'::text, 'google'::text, 'voice'::text, 'whatsapp'::text, 'voice_ai'::text]));