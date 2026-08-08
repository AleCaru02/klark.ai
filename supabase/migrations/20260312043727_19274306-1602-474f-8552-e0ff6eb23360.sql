
-- Referral codes: each user/tenant gets a unique referral code
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Referral relationships: who referred whom (max 2 levels)
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  referred_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1 CHECK (level IN (1, 2)),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_tenant_id, level)
);

-- Commission ledger: tracks earned commissions per renewal
CREATE TABLE public.referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  referred_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  subscription_id uuid REFERENCES public.subscriptions(id),
  amount_cents integer NOT NULL DEFAULT 0,
  rate_percent numeric(5,2) NOT NULL DEFAULT 5.00,
  status text NOT NULL DEFAULT 'pending',
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

-- Enable RLS
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

-- RLS: referral_codes
CREATE POLICY "Admins full access referral_codes" ON public.referral_codes FOR ALL USING (has_membership_role(auth.uid(), 'admin'::membership_role));
CREATE POLICY "Users view own referral_code" ON public.referral_codes FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Users insert own referral_code" ON public.referral_codes FOR INSERT WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

-- RLS: referrals
CREATE POLICY "Admins full access referrals" ON public.referrals FOR ALL USING (has_membership_role(auth.uid(), 'admin'::membership_role));
CREATE POLICY "Users view own referrals as referrer" ON public.referrals FOR SELECT USING (user_belongs_to_tenant(auth.uid(), referrer_tenant_id));
CREATE POLICY "Users view own referrals as referred" ON public.referrals FOR SELECT USING (user_belongs_to_tenant(auth.uid(), referred_tenant_id));

-- RLS: referral_commissions
CREATE POLICY "Admins full access referral_commissions" ON public.referral_commissions FOR ALL USING (has_membership_role(auth.uid(), 'admin'::membership_role));
CREATE POLICY "Users view own commissions" ON public.referral_commissions FOR SELECT USING (user_belongs_to_tenant(auth.uid(), referrer_tenant_id));

-- Allow public read of referral_codes for signup validation (by code only)
CREATE POLICY "Anyone can lookup referral code" ON public.referral_codes FOR SELECT TO anon USING (true);
