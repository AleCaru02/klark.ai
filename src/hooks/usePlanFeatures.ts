import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FeatureFlags {
  voice_enabled: boolean;
  calendar_enabled: boolean;
  whatsapp_enabled: boolean;
  crm_basic_enabled: boolean;
  crm_advanced_enabled: boolean;
  followup_basic_enabled: boolean;
  followup_advanced_enabled: boolean;
  ads_enabled: boolean;
  ai_training_basic_enabled: boolean;
  ai_training_advanced_enabled: boolean;
  analytics_basic_enabled: boolean;
  analytics_advanced_enabled: boolean;
  integrations_enabled: boolean;
  site_chat_enabled: boolean;
  site_chat_monthly_messages: number;
  max_phone_numbers: number;
  max_whatsapp_numbers: number;
  max_meta_pages: number;
  max_users: number;
}

export type TenantServiceStatus = "pending" | "active" | "suspended" | "cancelled";

const DEFAULT_FLAGS: FeatureFlags = {
  voice_enabled: false,
  calendar_enabled: false,
  whatsapp_enabled: false,
  crm_basic_enabled: false,
  crm_advanced_enabled: false,
  followup_basic_enabled: false,
  followup_advanced_enabled: false,
  ads_enabled: false,
  ai_training_basic_enabled: false,
  ai_training_advanced_enabled: false,
  analytics_basic_enabled: false,
  analytics_advanced_enabled: false,
  integrations_enabled: false,
  site_chat_enabled: false,
  site_chat_monthly_messages: 0,
  max_phone_numbers: 0,
  max_whatsapp_numbers: 0,
  max_meta_pages: 0,
  max_users: 1,
};

export function usePlanFeatures() {
  const { membership, isAdmin } = useAuth();
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [planName, setPlanName] = useState<string>("");
  const [planCode, setPlanCode] = useState<string>("");
  const [serviceStatus, setServiceStatus] = useState<TenantServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const tenantId = membership?.tenant_id;

  useEffect(() => {
    if (tenantId) void fetchFlags();
    else setLoading(false);
  }, [tenantId]);

  const fetchFlags = async () => {
    if (!tenantId) return;
    setLoading(true);
    setFlags(DEFAULT_FLAGS);
    setPlanName("");
    setPlanCode("");
    setServiceStatus(null);

    try {
      const { data: account, error: accountError } = await supabase
        .from("tenant_service_accounts")
        .select("plan_code,status,service_end_at")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (accountError) throw accountError;
      if (!account) return;

      const status = account.status as TenantServiceStatus;
      setServiceStatus(status);
      setPlanCode(account.plan_code);

      const expired = account.service_end_at
        ? new Date(account.service_end_at).getTime() <= Date.now()
        : false;
      if (status !== "active" || expired) return;

      const { data: plan, error: planError } = await supabase
        .from("plans")
        .select("name, code, feature_flags")
        .eq("code", account.plan_code)
        .single();
      if (planError) throw planError;

      setPlanName(plan.name);
      setPlanCode(plan.code);
      const featureFlags = plan.feature_flags as Record<string, unknown> | null;
      if (featureFlags && typeof featureFlags === "object") {
        setFlags({ ...DEFAULT_FLAGS, ...featureFlags } as FeatureFlags);
      }
    } catch (error) {
      console.error("Error fetching tenant service features:", error);
      setFlags(DEFAULT_FLAGS);
    } finally {
      setLoading(false);
    }
  };

  const hasFeature = (flag: keyof FeatureFlags): boolean => {
    if (isAdmin) return true;
    if (serviceStatus !== "active") return false;
    return Boolean(flags[flag]);
  };

  const getUpgradePlan = (_flag: keyof FeatureFlags): string => "piano assegnato";

  return {
    flags,
    planName,
    planCode,
    serviceStatus,
    loading,
    hasFeature,
    getUpgradePlan,
    refresh: fetchFlags,
  };
}
