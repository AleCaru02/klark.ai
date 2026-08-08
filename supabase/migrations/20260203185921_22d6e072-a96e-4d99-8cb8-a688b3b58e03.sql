-- Add columns to leads table for appointment linking
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS handoff_status text DEFAULT 'AI',
ADD COLUMN IF NOT EXISTS appointment_id uuid NULL;

-- Add foreign key constraint for appointment_id
ALTER TABLE public.leads 
ADD CONSTRAINT leads_appointment_id_fkey 
FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

-- Add columns to appointments table for meeting type and confirmation
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS meeting_type text DEFAULT 'online',
ADD COLUMN IF NOT EXISTS confirmation_deadline_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS lead_id uuid NULL;

-- Add foreign key constraint for lead_id in appointments
ALTER TABLE public.appointments
ADD CONSTRAINT appointments_lead_id_fkey
FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

-- Add columns to whatsapp_messages for appointment tracking
ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS lead_id uuid NULL,
ADD COLUMN IF NOT EXISTS appointment_id uuid NULL,
ADD COLUMN IF NOT EXISTS direction text DEFAULT 'in',
ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'other',
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'received';

-- Add foreign key constraints for whatsapp_messages
ALTER TABLE public.whatsapp_messages
ADD CONSTRAINT whatsapp_messages_lead_id_fkey
FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_messages
ADD CONSTRAINT whatsapp_messages_appointment_id_fkey
FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_leads_appointment_id ON public.leads(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON public.appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead_id ON public.whatsapp_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_appointment_id ON public.whatsapp_messages(appointment_id);