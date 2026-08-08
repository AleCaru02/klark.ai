import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ReferralCode {
  id: string;
  code: string;
  tenant_id: string;
  created_at: string;
}

interface Referral {
  id: string;
  referrer_tenant_id: string;
  referred_tenant_id: string;
  level: number;
  status: string;
  created_at: string;
}

interface Commission {
  id: string;
  referrer_tenant_id: string;
  referred_tenant_id: string;
  level: number;
  amount_cents: number;
  rate_percent: number;
  status: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  paid_at: string | null;
}

export function useReferral() {
  const { membership } = useAuth();
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  const tenantId = membership?.tenant_id;

  const generateCode = useCallback(async () => {
    if (!tenantId || !membership?.user_id) return;
    
    // Generate a unique 8-char code
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "CK-";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];

    const { data, error } = await supabase
      .from("referral_codes")
      .insert({ tenant_id: tenantId, user_id: membership.user_id, code })
      .select()
      .single();

    if (error) {
      // Maybe already exists
      if (error.code === "23505") {
        await fetchData();
        return;
      }
      toast.error("Errore nella generazione del codice referral");
      console.error(error);
      return;
    }

    setReferralCode(data as ReferralCode);
    toast.success("Codice referral generato!");
  }, [tenantId, membership?.user_id]);

  const fetchData = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [codeRes, refRes, commRes] = await Promise.all([
      supabase.from("referral_codes").select("*").eq("tenant_id", tenantId).maybeSingle(),
      supabase.from("referrals").select("*").eq("referrer_tenant_id", tenantId).order("created_at", { ascending: false }),
      supabase.from("referral_commissions").select("*").eq("referrer_tenant_id", tenantId).order("created_at", { ascending: false }),
    ]);

    if (codeRes.data) setReferralCode(codeRes.data as ReferralCode);
    if (refRes.data) setReferrals(refRes.data as Referral[]);
    if (commRes.data) setCommissions(commRes.data as Commission[]);

    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalEarnedCents = commissions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + c.amount_cents, 0);

  const totalPendingCents = commissions
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + c.amount_cents, 0);

  const level1Referrals = referrals.filter((r) => r.level === 1);
  const level2Referrals = referrals.filter((r) => r.level === 2);

  const referralLink = referralCode
    ? `${window.location.origin}/checkout?ref=${referralCode.code}`
    : null;

  const copyLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      toast.success("Link copiato!");
    }
  };

  return {
    loading,
    referralCode,
    referrals,
    commissions,
    totalEarnedCents,
    totalPendingCents,
    level1Referrals,
    level2Referrals,
    referralLink,
    generateCode,
    copyLink,
    refetch: fetchData,
  };
}
