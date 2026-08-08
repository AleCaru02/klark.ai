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
  const [loading, setLoading] = useState(true);

  const tenantId = membership?.tenant_id;

  useEffect(() => {
    if (tenantId) void fetchFlags();
    else setLoading(false);
  }, [tenantId]);

  const fetchFlags = async () => {
    if (!tenantId) return;
    try {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_code")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .maybeSingle();

      if (!sub) {
        setLoading(false);
        return;
      }

      const { data: plan } = await supabase
        .from("plans")
        .select("name, code, feature_flags")
        .eq("code", sub.plan_code)
        .single();

      if (plan) {
        setPlanName(plan.name);
        setPlanCode(plan.code);
        const ff = (plan as any).feature_flags as Record<string, unknown>;
        if (ff && typeof ff === "object") {
          setFlags({ ...DEFAULT_FLAGS, ...ff } as FeatureFlags);
        }
      }
    } catch (err) {
      console.error("Error fetching plan features:", err);
    } finally {
      setLoading(false);
    }
  };

  const hasFeature = (flag: keyof FeatureFlags): boolean => {
    if (isAdmin) return true;
    return Boolean(flags[flag]);
  };

  const getUpgradePlan = (flag: keyof FeatureFlags): string => {
    const growthFlags: (keyof FeatureFlags)[] = [
      "whatsapp_enabled",
      "crm_basic_enabled",
      "followup_basic_enabled",
      "site_chat_enabled",
    ];
    const proFlags: (keyof FeatureFlags)[] = [
      "crm_advanced_enabled",
      "followup_advanced_enabled",
      "ads_enabled",
      "ai_training_advanced_enabled",
      "analytics_advanced_enabled",
      "integrations_enabled",
    ];

    if (proFlags.includes(flag)) return "Pro";
    if (growthFlags.includes(flag)) return "Growth";
    return "Growth";
  };

  return { flags, planName, planCode, loading, hasFeature, getUpgradePlan };
}
