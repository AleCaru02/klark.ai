-- Create table for storing Google OAuth tokens per tenant
CREATE TABLE public.google_tokens (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can do everything on google_tokens"
ON public.google_tokens
FOR ALL
USING (has_membership_role(auth.uid(), 'admin'::membership_role));

-- Customers can view/update their own tenant tokens
CREATE POLICY "Customers can view own tenant google_tokens"
ON public.google_tokens
FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Customers can update own tenant google_tokens"
ON public.google_tokens
FOR UPDATE
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Customers can insert own tenant google_tokens"
ON public.google_tokens
FOR INSERT
WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Customers can delete own tenant google_tokens"
ON public.google_tokens
FOR DELETE
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Trigger for updated_at
CREATE TRIGGER update_google_tokens_updated_at
BEFORE UPDATE ON public.google_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();