
ALTER TABLE public.appointments DROP CONSTRAINT appointments_created_from_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_created_from_check 
  CHECK (created_from = ANY (ARRAY['app'::text, 'google'::text, 'voice'::text, 'whatsapp'::text, 'voice_ai'::text, 'crm'::text]));
