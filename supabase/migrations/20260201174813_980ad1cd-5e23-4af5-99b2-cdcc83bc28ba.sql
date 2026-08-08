-- Tabella per salvare le credenziali WhatsApp Business di ogni tenant
CREATE TABLE public.whatsapp_integrations (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  waba_id text NOT NULL, -- WhatsApp Business Account ID
  phone_number_id text NOT NULL, -- Phone Number ID
  access_token text NOT NULL, -- User Access Token (long-lived)
  display_phone_number text, -- Numero visualizzato es. +39 02 1234 5678
  verified_name text, -- Nome verificato del business
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabella per i template WhatsApp di ogni tenant
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_name text NOT NULL, -- Nome template su Meta (es. appointment_confirmation)
  template_type text NOT NULL, -- confirmation, reminder, canceled, rescheduled, missed_call
  body_text text NOT NULL, -- Testo del template con placeholder {{1}}, {{2}}, etc.
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  meta_template_id text, -- ID restituito da Meta dopo creazione
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, template_type)
);

-- Enable RLS
ALTER TABLE public.whatsapp_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_integrations
CREATE POLICY "Admins can do everything on whatsapp_integrations"
  ON public.whatsapp_integrations FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can view own tenant whatsapp_integrations"
  ON public.whatsapp_integrations FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Customers can insert own tenant whatsapp_integrations"
  ON public.whatsapp_integrations FOR INSERT
  WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Customers can update own tenant whatsapp_integrations"
  ON public.whatsapp_integrations FOR UPDATE
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Customers can delete own tenant whatsapp_integrations"
  ON public.whatsapp_integrations FOR DELETE
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- RLS policies for whatsapp_templates
CREATE POLICY "Admins can do everything on whatsapp_templates"
  ON public.whatsapp_templates FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can manage own tenant whatsapp_templates"
  ON public.whatsapp_templates FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Trigger per updated_at
CREATE TRIGGER update_whatsapp_integrations_updated_at
  BEFORE UPDATE ON public.whatsapp_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();