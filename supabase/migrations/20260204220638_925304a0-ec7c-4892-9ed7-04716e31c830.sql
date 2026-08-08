-- Create table to track discovered Facebook forms FIRST
CREATE TABLE public.facebook_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  external_form_id text NOT NULL,
  form_name text,
  page_id text,
  page_name text,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_lead_at timestamp with time zone,
  lead_count integer DEFAULT 0,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, external_form_id)
);

-- Enable RLS
ALTER TABLE public.facebook_forms ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can do everything on facebook_forms"
  ON public.facebook_forms FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can manage own tenant facebook_forms"
  ON public.facebook_forms FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Add active form fields to settings table (NOW table exists)
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS active_facebook_form_id uuid REFERENCES public.facebook_forms(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS facebook_webhook_secret text;

-- Add column to contacts to flag non-active form leads
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS from_inactive_form boolean DEFAULT false;