
-- Add stage_type, color, is_active to stages table
ALTER TABLE public.stages 
  ADD COLUMN stage_type text NOT NULL DEFAULT 'new_lead',
  ADD COLUMN color text NOT NULL DEFAULT '#3B82F6',
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.stages.stage_type IS 'Internal logical type: new_lead, to_call, callback_scheduled, appointment_set, nurturing, closed_won, closed_lost';
