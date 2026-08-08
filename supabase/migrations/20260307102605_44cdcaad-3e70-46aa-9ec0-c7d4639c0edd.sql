
-- Add billing columns to plans table
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS monthly_price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS included_voice_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS included_wa_messages integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overage_voice_cent_per_min integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS overage_wa_cent_per_msg integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS overage_mode text NOT NULL DEFAULT 'overage',
  ADD COLUMN IF NOT EXISTS warning_thresholds jsonb NOT NULL DEFAULT '[70, 85, 100]'::jsonb,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Create usage_alerts table
CREATE TABLE IF NOT EXISTS public.usage_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource text NOT NULL,
  threshold_percent integer NOT NULL,
  alert_type text NOT NULL,
  period_month date NOT NULL,
  channel text NOT NULL DEFAULT 'dashboard',
  message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for usage_alerts
ALTER TABLE public.usage_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on usage_alerts"
  ON public.usage_alerts FOR ALL
  TO authenticated
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can view own tenant usage_alerts"
  ON public.usage_alerts FOR SELECT
  TO authenticated
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Add overage_mode to settings for per-tenant override
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS overage_mode_override text DEFAULT NULL;
