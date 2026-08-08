-- FASE 1: Schema CRM + Follow-up Multi-tenant

-- A) profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);

-- B) leads table
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone_e164 text,
  email text,
  source text,
  form_payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'TO_CALL', 'IN_CONVO', 'NO_ANSWER', 'APPOINTMENT_SET', 'CLIENT', 'LOST', 'DO_NOT_CONTACT')),
  priority_score int DEFAULT 0,
  tags text[] DEFAULT '{}',
  notes text,
  last_contact_at timestamptz,
  next_action_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_tenant_status_next ON public.leads(tenant_id, status, next_action_at);
CREATE INDEX idx_leads_tenant_created ON public.leads(tenant_id, created_at DESC);
CREATE INDEX idx_leads_tenant_phone ON public.leads(tenant_id, phone_e164);

-- C) interactions table
CREATE TABLE public.interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('call', 'whatsapp', 'email', 'simulated')),
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  content text,
  outcome text CHECK (outcome IN ('answered', 'no_answer', 'busy', 'opt_out', 'appointment_set', 'rescheduled', 'cancelled', 'none')),
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_interactions_tenant_lead_created ON public.interactions(tenant_id, lead_id, created_at DESC);

-- D) followup_rules table (1 row per tenant)
CREATE TABLE public.followup_rules (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  max_attempts_call int NOT NULL DEFAULT 3,
  max_attempts_whatsapp int NOT NULL DEFAULT 4,
  retry_after_no_answer_minutes int NOT NULL DEFAULT 240,
  daily_call_window_start text NOT NULL DEFAULT '09:00',
  daily_call_window_end text NOT NULL DEFAULT '19:00',
  quiet_hours_start text NOT NULL DEFAULT '21:00',
  quiet_hours_end text NOT NULL DEFAULT '08:00',
  stop_words text[] NOT NULL DEFAULT '{STOP,ANNULLA,NON SCRIVERMI}',
  tone text NOT NULL DEFAULT 'professionale, umano, diretto',
  sector text NOT NULL DEFAULT 'professionista generico'
);

-- E) followup_queue table
CREATE TABLE public.followup_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('CALL', 'WHATSAPP', 'WAIT', 'CLOSE')),
  planned_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DONE', 'FAILED', 'SKIPPED')),
  attempt_no int NOT NULL DEFAULT 1,
  reason text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_followup_queue_tenant_status_planned ON public.followup_queue(tenant_id, status, planned_at);

-- ============================================
-- RLS HELPER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_profile_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_has_profile_in_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND tenant_id = _tenant_id
  )
$$;

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_queue ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- profiles: user can only see their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Admins (from memberships) can manage all profiles
CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

-- leads: users see only their tenant's leads
CREATE POLICY "Users can view tenant leads"
  ON public.leads FOR SELECT
  USING (user_has_profile_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can insert tenant leads"
  ON public.leads FOR INSERT
  WITH CHECK (user_has_profile_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can update tenant leads"
  ON public.leads FOR UPDATE
  USING (user_has_profile_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can delete tenant leads"
  ON public.leads FOR DELETE
  USING (user_has_profile_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage all leads"
  ON public.leads FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

-- interactions: users see only their tenant's interactions
CREATE POLICY "Users can view tenant interactions"
  ON public.interactions FOR SELECT
  USING (user_has_profile_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can insert tenant interactions"
  ON public.interactions FOR INSERT
  WITH CHECK (user_has_profile_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can update tenant interactions"
  ON public.interactions FOR UPDATE
  USING (user_has_profile_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage all interactions"
  ON public.interactions FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

-- followup_rules: users see only their tenant's rules
CREATE POLICY "Users can view tenant followup_rules"
  ON public.followup_rules FOR SELECT
  USING (user_has_profile_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can update tenant followup_rules"
  ON public.followup_rules FOR UPDATE
  USING (user_has_profile_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can insert tenant followup_rules"
  ON public.followup_rules FOR INSERT
  WITH CHECK (user_has_profile_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage all followup_rules"
  ON public.followup_rules FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

-- followup_queue: users see only their tenant's queue
CREATE POLICY "Users can view tenant followup_queue"
  ON public.followup_queue FOR SELECT
  USING (user_has_profile_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can insert tenant followup_queue"
  ON public.followup_queue FOR INSERT
  WITH CHECK (user_has_profile_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can update tenant followup_queue"
  ON public.followup_queue FOR UPDATE
  USING (user_has_profile_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can delete tenant followup_queue"
  ON public.followup_queue FOR DELETE
  USING (user_has_profile_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage all followup_queue"
  ON public.followup_queue FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));