-- Add stage column to contacts for sheet categorization
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'FB_INBOX';

-- Add zoom_link and appointment_datetime columns for auto-move logic
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS zoom_link TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS appointment_datetime TIMESTAMP WITH TIME ZONE;

-- Create index for stage-based filtering
CREATE INDEX IF NOT EXISTS idx_contacts_stage ON public.contacts(tenant_id, stage);

-- Create enum-like check constraint for valid stages
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_stage_check;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_stage_check 
  CHECK (stage IN ('FB_INBOX', 'APPOINTMENTS', 'CALL_LATER', 'CLOSED'));