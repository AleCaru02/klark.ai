import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PlanDetails {
  code: string;
  name: string;
  monthly_price_cents: number;
  included_voice_minutes: number;
  included_wa_messages: number;
  overage_voice_cent_per_min: number;
  overage_wa_cent_per_msg: number;
  overage_mode: string;
  warning_thresholds: number[];
  features: string[];
}

export interface SubscriptionInfo {
  id: string;
  plan_code: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  stripe_customer_id: string | null;
}

export interface UsageData {
  voiceSecondsUsed: number;
  voiceMinutesUsed: number;
  waMessagesUsed: number;
}

export type UsageStatus = "regular" | "warning" | "critical" | "exceeded" | "overage";

export interface ResourceUsage {
  used: number;
  included: number;
  remaining: number;
  percentage: number;
  status: UsageStatus;
  overageUnits: number;
  overageCostCents: number;
}

export interface UsageAlert {
  id: string;
  resource: string;
  threshold_percent: number;
  alert_type: string;
  message: string | null;
  sent_at: string;
}

function getStatus(percentage: number): UsageStatus {
  if (percentage >= 100) return "overage";
  if (percentage >= 95) return "exceeded";
  if (percentage >= 85) return "critical";
  if (percentage >= 70) return "warning";
  return "regular";
}

export function useBilling() {
  const { membership } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanDetails | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [usage, setUsage] = useState<UsageData>({ voiceSecondsUsed: 0, voiceMinutesUsed: 0, waMessagesUsed: 0 });
  const [alerts, setAlerts] = useState<UsageAlert[]>([]);
  const [overageMode, setOverageMode] = useState<string>("overage");

  const tenantId = membership?.tenant_id;

  useEffect(() => {
    if (tenantId) fetchAll();
  }, [tenantId]);

  const fetchAll = async () => {
    if (!tenantId) return;
    setLoading(true);

    try {
      // Fetch subscription + plan + settings + usage + alerts in parallel
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const monthStartStr = monthStart.toISOString().split("T")[0];
      const monthEndStr = monthEnd.toISOString().split("T")[0];
      const periodMonth = monthStartStr;

      const [subRes, voiceRes, waRes, alertsRes, settingsRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .maybeSingle(),
        supabase
          .from("usage_voice_daily")
          .select("connected_seconds")
          .eq("tenant_id", tenantId)
          .gte("date", monthStartStr)
          .lte("date", monthEndStr),
        supabase
          .from("usage_wa_daily")
          .select("template_counts_json")
          .eq("tenant_id", tenantId)
          .gte("date", monthStartStr)
          .lte("date", monthEndStr),
        supabase
          .from("usage_alerts")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("period_month", periodMonth)
          .order("sent_at", { ascending: false })
          .limit(10),
        supabase
          .from("settings")
          .select("overage_mode_override")
          .eq("tenant_id", tenantId)
          .maybeSingle(),
      ]);

      if (subRes.data) {
        setSubscription(subRes.data as SubscriptionInfo);

        // Fetch plan
        const { data: planData } = await supabase
          .from("plans")
          .select("*")
          .eq("code", subRes.data.plan_code)
          .single();

        if (planData) {
          const p: PlanDetails = {
            code: planData.code,
            name: planData.name,
            monthly_price_cents: (planData as any).monthly_price_cents ?? 0,
            included_voice_minutes: (planData as any).included_voice_minutes ?? 0,
            included_wa_messages: (planData as any).included_wa_messages ?? 0,
            overage_voice_cent_per_min: (planData as any).overage_voice_cent_per_min ?? 45,
            overage_wa_cent_per_msg: (planData as any).overage_wa_cent_per_msg ?? 10,
            overage_mode: (planData as any).overage_mode ?? "overage",
            warning_thresholds: (planData as any).warning_thresholds ?? [70, 85, 100],
            features: (planData as any).features ?? [],
          };
          setPlan(p);
        }
      }

      // Calculate voice usage
      const totalVoiceSeconds = (voiceRes.data || []).reduce(
        (sum, row) => sum + (row.connected_seconds || 0), 0
      );

      // Calculate WA usage
      const totalWaMessages = (waRes.data || []).reduce((sum, row) => {
        if (row.template_counts_json && typeof row.template_counts_json === "object") {
          return sum + Object.values(row.template_counts_json as Record<string, number>).reduce(
            (a, b) => a + b, 0
          );
        }
        return sum;
      }, 0);

      setUsage({
        voiceSecondsUsed: totalVoiceSeconds,
        voiceMinutesUsed: Math.ceil(totalVoiceSeconds / 60),
        waMessagesUsed: totalWaMessages,
      });

      setAlerts((alertsRes.data || []) as UsageAlert[]);

      if (settingsRes.data?.overage_mode_override) {
        setOverageMode(settingsRes.data.overage_mode_override);
      }
    } catch (error) {
      console.error("Error fetching billing data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Compute resource usage
  const voiceUsage: ResourceUsage = (() => {
    const included = plan?.included_voice_minutes ?? 0;
    const used = usage.voiceMinutesUsed;
    const remaining = Math.max(0, included - used);
    const percentage = included > 0 ? (used / included) * 100 : 0;
    const overageUnits = Math.max(0, used - included);
    const overageCostCents = overageUnits * (plan?.overage_voice_cent_per_min ?? 45);
    return { used, included, remaining, percentage, status: getStatus(percentage), overageUnits, overageCostCents };
  })();

  const waUsage: ResourceUsage = (() => {
    const included = plan?.included_wa_messages ?? 0;
    const used = usage.waMessagesUsed;
    const remaining = Math.max(0, included - used);
    const percentage = included > 0 ? (used / included) * 100 : 0;
    const overageUnits = Math.max(0, used - included);
    const overageCostCents = overageUnits * (plan?.overage_wa_cent_per_msg ?? 10);
    return { used, included, remaining, percentage, status: getStatus(percentage), overageUnits, overageCostCents };
  })();

  const totalOverageCents = voiceUsage.overageCostCents + waUsage.overageCostCents;
  const effectiveOverageMode = overageMode || plan?.overage_mode || "overage";

  return {
    loading,
    plan,
    subscription,
    usage,
    voiceUsage,
    waUsage,
    alerts,
    totalOverageCents,
    overageMode: effectiveOverageMode,
    refresh: fetchAll,
  };
}
