-- Create facebook_integrations table to store tenant-specific Meta tokens and config
CREATE TABLE public.facebook_integrations (
    tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    page_id text NOT NULL,
    form_id text,
    access_token text NOT NULL,
    token_expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.facebook_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies: admin can do everything, customers can view own tenant
CREATE POLICY "Admins can do everything on facebook_integrations" 
ON public.facebook_integrations 
FOR ALL 
USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can view own tenant facebook_integrations" 
ON public.facebook_integrations 
FOR SELECT 
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Create facebook_lead_imports table to track imported leads
CREATE TABLE public.facebook_lead_imports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    leadgen_id text NOT NULL,
    form_id text,
    page_id text,
    raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    imported_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, leadgen_id)
);

-- Enable RLS
ALTER TABLE public.facebook_lead_imports ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can do everything on facebook_lead_imports" 
ON public.facebook_lead_imports 
FOR ALL 
USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can view own tenant facebook_lead_imports" 
ON public.facebook_lead_imports 
FOR SELECT 
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Add trigger for updated_at on facebook_integrations
CREATE TRIGGER update_facebook_integrations_updated_at
BEFORE UPDATE ON public.facebook_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();