-- Table for raw webhook events
CREATE TABLE public.whatsapp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can do everything on whatsapp_events"
  ON public.whatsapp_events FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can view own tenant whatsapp_events"
  ON public.whatsapp_events FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Table for incoming messages
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  wa_from text NOT NULL,
  message_id text NOT NULL UNIQUE,
  text text,
  ts timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can do everything on whatsapp_messages"
  ON public.whatsapp_messages FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can view own tenant whatsapp_messages"
  ON public.whatsapp_messages FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Table for message statuses
CREATE TABLE public.whatsapp_message_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  message_id text NOT NULL,
  status text NOT NULL,
  recipient_id text,
  ts timestamptz NOT NULL,
  error_code integer,
  error_title text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_message_statuses ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can do everything on whatsapp_message_statuses"
  ON public.whatsapp_message_statuses FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can view own tenant whatsapp_message_statuses"
  ON public.whatsapp_message_statuses FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Index for lookups
CREATE INDEX idx_whatsapp_messages_wa_from ON public.whatsapp_messages(wa_from);
CREATE INDEX idx_whatsapp_messages_message_id ON public.whatsapp_messages(message_id);
CREATE INDEX idx_whatsapp_message_statuses_message_id ON public.whatsapp_message_statuses(message_id);