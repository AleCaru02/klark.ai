-- Create lead_call_recaps table for AI-generated call summaries
CREATE TABLE public.lead_call_recaps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    call_log_id uuid REFERENCES public.call_logs(id) ON DELETE SET NULL,
    summary_bullets_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    next_step text,
    objections text,
    priority text CHECK (priority IN ('alta', 'media', 'bassa')),
    raw_input text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_call_recaps ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can do everything on lead_call_recaps" 
ON public.lead_call_recaps 
FOR ALL 
USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can manage own tenant lead_call_recaps" 
ON public.lead_call_recaps 
FOR ALL 
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Add trigger for updated_at
CREATE TRIGGER update_lead_call_recaps_updated_at
BEFORE UPDATE ON public.lead_call_recaps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_lead_call_recaps_contact_id ON public.lead_call_recaps(contact_id);
CREATE INDEX idx_lead_call_recaps_tenant_id ON public.lead_call_recaps(tenant_id);