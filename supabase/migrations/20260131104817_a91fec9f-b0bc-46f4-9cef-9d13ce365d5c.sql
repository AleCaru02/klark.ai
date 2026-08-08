
-- Drop existing tables to rebuild with new schema
DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;
DROP TABLE IF EXISTS public.call_logs CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.secretary_settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.has_role CASCADE;
DROP FUNCTION IF EXISTS public.get_user_tenant_id CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS public.app_role CASCADE;

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE public.membership_role AS ENUM ('admin', 'customer');
CREATE TYPE public.formality_type AS ENUM ('tu', 'lei');
CREATE TYPE public.tone_type AS ENUM ('standard', 'formale', 'amichevole');
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'rescheduled', 'canceled');
CREATE TYPE public.call_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.message_category AS ENUM ('utility', 'marketing', 'auth', 'service');
CREATE TYPE public.message_status AS ENUM ('sent', 'failed', 'delivered', 'read');

-- ============================================
-- TABLES
-- ============================================

-- Tenants
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Memberships (replaces profiles + user_roles)
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role membership_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Plans
CREATE TABLE public.plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  included_connected_seconds_per_quarter INT NOT NULL DEFAULT 0,
  included_wa_templates_per_quarter INT NOT NULL DEFAULT 0,
  price_per_quarter_cents INT NOT NULL DEFAULT 0
);

-- Subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES public.plans(code),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Settings
CREATE TABLE public.settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  language_voice TEXT DEFAULT 'it',
  language_whatsapp TEXT DEFAULT 'it',
  formality formality_type DEFAULT 'lei',
  tone tone_type DEFAULT 'standard',
  voice_pack_id TEXT,
  calendar_id TEXT,
  availability_json JSONB DEFAULT '{"monday":{"start":"09:00","end":"18:00"},"tuesday":{"start":"09:00","end":"18:00"},"wednesday":{"start":"09:00","end":"18:00"},"thursday":{"start":"09:00","end":"18:00"},"friday":{"start":"09:00","end":"18:00"}}'::jsonb,
  booking_rules_json JSONB DEFAULT '{"min_notice_hours":24,"max_advance_days":30,"slot_duration_minutes":30}'::jsonb,
  whatsapp_templates_json JSONB DEFAULT '[]'::jsonb,
  recording_opt_in BOOLEAN DEFAULT false,
  retention_days INT DEFAULT 365,
  do_not_contact_default BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contacts
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_e164 TEXT,
  email TEXT,
  do_not_contact BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appointments
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  calendar_event_id TEXT,
  meet_link TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status appointment_status DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calendar Links
CREATE TABLE public.calendar_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  calendar_event_id TEXT UNIQUE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  whatsapp_to_e164 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Call Logs
CREATE TABLE public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  twilio_call_sid TEXT,
  direction call_direction DEFAULT 'inbound',
  connected_seconds INT DEFAULT 0,
  recording_url TEXT,
  transcript TEXT,
  outcome_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Message Logs
CREATE TABLE public.message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  channel TEXT DEFAULT 'whatsapp',
  category message_category DEFAULT 'utility',
  template_name TEXT,
  provider_message_id TEXT,
  status message_status DEFAULT 'sent',
  payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usage Voice Daily
CREATE TABLE public.usage_voice_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  connected_seconds INT DEFAULT 0,
  UNIQUE(tenant_id, date)
);

-- Usage WhatsApp Daily
CREATE TABLE public.usage_wa_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  template_counts_json JSONB DEFAULT '{}'::jsonb,
  UNIQUE(tenant_id, date)
);

-- Audit Log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  actor_user_id UUID,
  action TEXT NOT NULL,
  payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX idx_memberships_tenant_id ON public.memberships(tenant_id);
CREATE INDEX idx_contacts_tenant_id ON public.contacts(tenant_id);
CREATE INDEX idx_contacts_phone ON public.contacts(phone_e164);
CREATE INDEX idx_appointments_tenant_id ON public.appointments(tenant_id);
CREATE INDEX idx_appointments_start_at ON public.appointments(start_at);
CREATE INDEX idx_call_logs_tenant_id ON public.call_logs(tenant_id);
CREATE INDEX idx_call_logs_created_at ON public.call_logs(created_at);
CREATE INDEX idx_message_logs_tenant_id ON public.message_logs(tenant_id);
CREATE INDEX idx_message_logs_created_at ON public.message_logs(created_at);
CREATE INDEX idx_usage_voice_daily_tenant_date ON public.usage_voice_daily(tenant_id, date);
CREATE INDEX idx_usage_wa_daily_tenant_date ON public.usage_wa_daily(tenant_id, date);
CREATE INDEX idx_audit_log_tenant_id ON public.audit_log(tenant_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at);

-- ============================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================

-- Get user's tenant ID from membership
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.memberships WHERE user_id = _user_id LIMIT 1
$$;

-- Check if user has a specific role in any tenant
CREATE OR REPLACE FUNCTION public.has_membership_role(_user_id UUID, _role membership_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if user belongs to a specific tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
  )
$$;

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_voice_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_wa_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- TENANTS
CREATE POLICY "Admins can do everything on tenants"
  ON public.tenants FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can view own tenant"
  ON public.tenants FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), id));

-- MEMBERSHIPS
CREATE POLICY "Admins can do everything on memberships"
  ON public.memberships FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own membership"
  ON public.memberships FOR SELECT
  USING (user_id = auth.uid());

-- PLANS (public read)
CREATE POLICY "Anyone can view plans"
  ON public.plans FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage plans"
  ON public.plans FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'));

-- SUBSCRIPTIONS
CREATE POLICY "Admins can do everything on subscriptions"
  ON public.subscriptions FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can view own tenant subscriptions"
  ON public.subscriptions FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- SETTINGS
CREATE POLICY "Admins can do everything on settings"
  ON public.settings FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can view own tenant settings"
  ON public.settings FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Customers can update own tenant settings"
  ON public.settings FOR UPDATE
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- CONTACTS
CREATE POLICY "Admins can do everything on contacts"
  ON public.contacts FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can manage own tenant contacts"
  ON public.contacts FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- APPOINTMENTS
CREATE POLICY "Admins can do everything on appointments"
  ON public.appointments FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can manage own tenant appointments"
  ON public.appointments FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- CALENDAR LINKS
CREATE POLICY "Admins can do everything on calendar_links"
  ON public.calendar_links FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can manage own tenant calendar_links"
  ON public.calendar_links FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- CALL LOGS
CREATE POLICY "Admins can do everything on call_logs"
  ON public.call_logs FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can view own tenant call_logs"
  ON public.call_logs FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Customers can insert own tenant call_logs"
  ON public.call_logs FOR INSERT
  WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

-- MESSAGE LOGS
CREATE POLICY "Admins can do everything on message_logs"
  ON public.message_logs FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can view own tenant message_logs"
  ON public.message_logs FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Customers can insert own tenant message_logs"
  ON public.message_logs FOR INSERT
  WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

-- USAGE VOICE DAILY
CREATE POLICY "Admins can do everything on usage_voice_daily"
  ON public.usage_voice_daily FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can view own tenant usage_voice_daily"
  ON public.usage_voice_daily FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- USAGE WA DAILY
CREATE POLICY "Admins can do everything on usage_wa_daily"
  ON public.usage_wa_daily FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can view own tenant usage_wa_daily"
  ON public.usage_wa_daily FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- AUDIT LOG
CREATE POLICY "Admins can do everything on audit_log"
  ON public.audit_log FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can view own tenant audit_log"
  ON public.audit_log FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply to tables with updated_at
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SEED PLANS
-- ============================================
INSERT INTO public.plans (code, name, included_connected_seconds_per_quarter, included_wa_templates_per_quarter, price_per_quarter_cents) VALUES
  ('voice_start', 'Voice Start', 12000, 0, 14700),
  ('voice_pro', 'Voice Pro', 36000, 0, 29700),
  ('voice_business', 'Voice Business', 72000, 0, 44700),
  ('wa_start', 'WhatsApp Start', 0, 300, 8700),
  ('wa_pro', 'WhatsApp Pro', 0, 600, 14700),
  ('wa_business', 'WhatsApp Business', 0, 1200, 23700),
  ('combo_start', 'Combo Start', 12000, 300, 20700),
  ('combo_pro', 'Combo Pro', 36000, 600, 38700),
  ('combo_business', 'Combo Business', 72000, 1200, 59700);
