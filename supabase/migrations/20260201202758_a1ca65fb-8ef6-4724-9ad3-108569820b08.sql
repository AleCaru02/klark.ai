-- Tabella numeri telefonici per tenant (gestiti dall'admin)
CREATE TABLE public.tenant_phone_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  phone_type TEXT NOT NULL CHECK (phone_type IN ('voice', 'whatsapp')),
  twilio_sid TEXT, -- SID del numero su Twilio (per voice)
  country_code TEXT DEFAULT 'IT',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  monthly_cost_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, phone_type) -- Un solo numero per tipo per tenant
);

-- Indice per lookup veloce
CREATE INDEX idx_tenant_phone_numbers_tenant ON public.tenant_phone_numbers(tenant_id);
CREATE INDEX idx_tenant_phone_numbers_phone ON public.tenant_phone_numbers(phone_number);

-- RLS
ALTER TABLE public.tenant_phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on tenant_phone_numbers"
  ON public.tenant_phone_numbers FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can view own tenant phone_numbers"
  ON public.tenant_phone_numbers FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Trigger per updated_at
CREATE TRIGGER update_tenant_phone_numbers_updated_at
  BEFORE UPDATE ON public.tenant_phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabella coda chiamate con retry logic
CREATE TABLE public.call_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'calling', 'completed', 'no_answer', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 0, -- Higher = more urgent
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  last_call_sid TEXT, -- Ultimo Twilio call SID
  outcome TEXT, -- 'booked', 'callback_requested', 'not_interested', etc.
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indici per query frequenti
CREATE INDEX idx_call_queue_tenant ON public.call_queue(tenant_id);
CREATE INDEX idx_call_queue_status ON public.call_queue(status);
CREATE INDEX idx_call_queue_next_attempt ON public.call_queue(next_attempt_at) WHERE status IN ('pending', 'no_answer');

-- RLS
ALTER TABLE public.call_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on call_queue"
  ON public.call_queue FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can manage own tenant call_queue"
  ON public.call_queue FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Trigger per updated_at
CREATE TRIGGER update_call_queue_updated_at
  BEFORE UPDATE ON public.call_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Aggiungere colonne a settings per AI prompt e retry config
ALTER TABLE public.settings 
  ADD COLUMN IF NOT EXISTS ai_prompt_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS retry_config_json JSONB DEFAULT '{"max_attempts": 5, "retry_after_hours": 4, "send_whatsapp_on_no_answer": true}'::jsonb;