import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requireServiceRole,
} from "../_shared/security.ts";

interface ServiceAccountRow {
  tenant_id: string;
  plan_code: string;
}

interface PlanRow {
  included_connected_seconds_per_quarter: number;
  included_wa_templates_per_quarter: number;
  warning_thresholds: unknown;
}

interface VoiceRow {
  connected_seconds: number | null;
}

interface WhatsAppRow {
  template_counts_json: unknown;
}

interface ExistingAlertRow {
  resource: string;
  threshold_percent: number;
}

function parseThresholds(value: unknown): number[] {
  const source = Array.isArray(value) ? value : [70, 85, 100];
  const thresholds = source
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0 && item <= 100);
  return [...new Set(thresholds)].sort((a, b) => a - b);
}

function countTemplates(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const values = Object.values(value as Record<string, unknown>);
  return values.reduce<number>(
    (sum, item) => sum + (Number.isFinite(Number(item)) ? Math.max(0, Number(item)) : 0),
    0,
  );
}

function currentQuarter(): { start: Date; end: Date } {
  const now = new Date();
  const startMonth = Math.floor(now.getUTCMonth() / 3) * 3;
  const start = new Date(Date.UTC(now.getUTCFullYear(), startMonth, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), startMonth + 3, 1));
  return { start, end };
}

function resolvePeriod(): { start: Date; end: Date; key: string } {
  const period = currentQuarter();
  return { start: period.start, end: period.end, key: period.start.toISOString().slice(0, 10) };
}


Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
  }

  try {
    requireServiceRole(request);
    const client = createServiceClient();
    const { data: serviceAccountData, error: serviceAccountError } = await client
      .from("tenant_service_accounts")
      .select("tenant_id,plan_code")
      .eq("status", "active");
    if (serviceAccountError) throw serviceAccountError;

    let checked = 0;
    let alertsCreated = 0;
    let failures = 0;

    for (const serviceAccount of (serviceAccountData ?? []) as ServiceAccountRow[]) {
      try {
        const period = resolvePeriod();
        const startDate = period.start.toISOString().slice(0, 10);
        const endExclusive = period.end.toISOString().slice(0, 10);

        const [planResult, voiceResult, whatsappResult, alertResult] = await Promise.all([
          client
            .from("plans")
            .select("included_connected_seconds_per_quarter,included_wa_templates_per_quarter,warning_thresholds")
            .eq("code", serviceAccount.plan_code)
            .maybeSingle(),
          client
            .from("usage_voice_daily")
            .select("connected_seconds")
            .eq("tenant_id", serviceAccount.tenant_id)
            .gte("date", startDate)
            .lt("date", endExclusive),
          client
            .from("usage_wa_daily")
            .select("template_counts_json")
            .eq("tenant_id", serviceAccount.tenant_id)
            .gte("date", startDate)
            .lt("date", endExclusive),
          client
            .from("usage_alerts")
            .select("resource,threshold_percent")
            .eq("tenant_id", serviceAccount.tenant_id)
            .eq("period_month", period.key),
        ]);
        if (planResult.error) throw planResult.error;
        if (voiceResult.error) throw voiceResult.error;
        if (whatsappResult.error) throw whatsappResult.error;
        if (alertResult.error) throw alertResult.error;
        if (!planResult.data) throw new Error("Plan not found");

        const plan = planResult.data as PlanRow;
        const thresholds = parseThresholds(plan.warning_thresholds);
        const voiceSeconds = ((voiceResult.data ?? []) as VoiceRow[]).reduce(
          (sum, row) => sum + Math.max(0, Number(row.connected_seconds ?? 0)),
          0,
        );
        const whatsappTemplates = ((whatsappResult.data ?? []) as WhatsAppRow[]).reduce(
          (sum, row) => sum + countTemplates(row.template_counts_json),
          0,
        );
        const existing = new Set(
          ((alertResult.data ?? []) as ExistingAlertRow[]).map(
            (row) => `${row.resource}:${row.threshold_percent}`,
          ),
        );

        const pendingAlerts: Array<Record<string, unknown>> = [];
        const resources = [
          {
            key: "voice",
            used: voiceSeconds,
            included: Math.max(0, Number(plan.included_connected_seconds_per_quarter)),
            unit: "secondi connessi",
          },
          {
            key: "whatsapp",
            used: whatsappTemplates,
            included: Math.max(0, Number(plan.included_wa_templates_per_quarter)),
            unit: "template WhatsApp",
          },
        ];

        for (const resource of resources) {
          if (resource.included <= 0) continue;
          const percent = (resource.used / resource.included) * 100;
          for (const threshold of thresholds) {
            if (percent < threshold || existing.has(`${resource.key}:${threshold}`)) continue;
            pendingAlerts.push({
              tenant_id: serviceAccount.tenant_id,
              resource: resource.key,
              threshold_percent: threshold,
              alert_type: threshold >= 100 ? "overage_active" : `threshold_${threshold}`,
              period_month: period.key,
              channel: "dashboard",
              message: threshold >= 100
                ? `La quota inclusa di ${resource.unit} per il periodo è stata raggiunta.`
                : `È stato utilizzato almeno il ${threshold}% della quota inclusa di ${resource.unit}.`,
              sent_at: new Date().toISOString(),
            });
          }
        }

        if (pendingAlerts.length > 0) {
          const { error: insertError } = await client.from("usage_alerts").insert(pendingAlerts);
          if (insertError && insertError.code !== "23505") throw insertError;
          if (!insertError) alertsCreated += pendingAlerts.length;
        }
        checked += 1;
      } catch {
        failures += 1;
        console.error("Usage threshold check failed for one tenant service account");
      }
    }

    const { error: auditError } = await client.from("audit_log").insert({
      tenant_id: null,
      action: "usage.thresholds_checked",
      payload_json: { checked, alerts_created: alertsCreated, failures },
    });
    if (auditError) console.error("Unable to write threshold audit event");

    return jsonResponse(
      { success: failures === 0, checked, alerts_created: alertsCreated, failures },
      failures === 0 ? 200 : 207,
    );
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error("check-usage-thresholds failed");
    return jsonResponse(
      { error: status < 500 && error instanceof Error ? error.message : "Threshold check failed" },
      status,
    );
  }
});
