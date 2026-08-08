-- Add contact_id to whatsapp_messages for linking
ALTER TABLE public.whatsapp_messages 
ADD COLUMN contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Add index for contact lookups
CREATE INDEX idx_whatsapp_messages_contact_id ON public.whatsapp_messages(contact_id);