import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireServiceRole,
} from "../_shared/security.ts";

interface ReportRequest {
  date?: unknown;
}

interface SubscriptionRow {
  id: string;
  tenant_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface VoiceRow {
  connected_seconds: number | null;
}

interface WhatsAppRow {
  template_counts_json: unknown;
}

function parseDate(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return yesterday.toISOString().slice(0, 10);
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AuthError("Invalid date", 400);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new AuthError("Invalid date", 400);
  }
  if (parsed.getTime() > Date.now()) throw new AuthError("Future dates are not allowed", 400);
  return value;
}

function countTemplates(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const values = Object.values(value as Record<string, unknown>);
  return values.reduce<number>(
    (sum, item) => sum + (Number.isFinite(Number(item)) ? Math.max(0, Number(item)) : 0),
    0,
  );
}

async function reportMeterEvent(input: {
  customerId: string;
  eventName: string;
  quantity: number;
  identifier: string;
  timestamp: number;
}): Promise<void> {
  const response = await fetch("https://api.stripe.com/v1/billing/meter_events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      event_name: input.eventName,
      identifier: input.identifier,
      timestamp: String(input.timestamp),
      "payload[stripe_customer_id]": input.customerId,
      "payload[value]": String(input.quantity),
    }),
  });

  if (!response.ok) {
    const providerRequestId = response.headers.get("request-id")?.slice(0, 100) ?? null;
    throw new Error(`Stripe meter event failed (${response.status}, ${providerRequestId ?? "no-request-id"})`);
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
  }

  try {
    requireServiceRole(request);
    if (Deno.env.get("STRIPE_USAGE_REPORTING_ENABLED") !== "true") {
      throw new AuthError("Stripe usage reporting is disabled", 409);
    }
    requiredEnv("STRIPE_SECRET_KEY");

    const payload = await request.json().catch(() => ({})) as ReportRequest;
    const date = parseDate(payload.date);
    const timestamp = Math.floor(new Date(`${date}T12:00:00.000Z`).getTime() / 1000);
    const client = createServiceClient();

    const { data: subscriptionData, error: subscriptionError } = await client
      .from("subscriptions")
      .select("id,tenant_id,stripe_customer_id,stripe_subscription_id")
      .eq("status", "active");
    if (subscriptionError) throw subscriptionError;

    let reportedEvents = 0;
    let skippedSubscriptions = 0;
    let failures = 0;

    for (const subscription of (subscriptionData ?? []) as SubscriptionRow[]) {
      try {
        if (!subscription.stripe_customer_id || !subscription.stripe_subscription_id) {
          skippedSubscriptions += 1;
          continue;
        }

        const [voiceResult, whatsappResult] = await Promise.all([
          client
            .from("usage_voice_daily")
            .select("connected_seconds")
            .eq("tenant_id", subscription.tenant_id)
            .eq("date", date)
            .maybeSingle(),
          client
            .from("usage_wa_daily")
            .select("template_counts_json")
            .eq("tenant_id", subscription.tenant_id)
            .eq("date", date)
            .maybeSingle(),
        ]);
        if (voiceResult.error) throw voiceResult.error;
        if (whatsappResult.error) throw whatsappResult.error;

        const voiceSeconds = Math.max(
          0,
          Number((voiceResult.data as VoiceRow | null)?.connected_seconds ?? 0),
        );
        const whatsappTemplates = countTemplates(
          (whatsappResult.data as WhatsAppRow | null)?.template_counts_json,
        );

        if (voiceSeconds > 0) {
          await reportMeterEvent({
            customerId: subscription.stripe_customer_id,
            eventName: requiredEnv("STRIPE_VOICE_METER_EVENT_NAME"),
            quantity: voiceSeconds,
            identifier: `voice-${subscription.id}-${date}`,
            timestamp,
          });
          reportedEvents += 1;
        }
        if (whatsappTemplates > 0) {
          await reportMeterEvent({
            customerId: subscription.stripe_customer_id,
            eventName: requiredEnv("STRIPE_WHATSAPP_METER_EVENT_NAME"),
            quantity: whatsappTemplates,
            identifier: `whatsapp-${subscription.id}-${date}`,
            timestamp,
          });
          reportedEvents += 1;
        }
      } catch {
        failures += 1;
        console.error("Stripe usage reporting failed for one subscription");
      }
    }

    const { error: auditError } = await client.from("audit_log").insert({
      tenant_id: null,
      action: "stripe.usage_report_completed",
      payload_json: {
        date,
        reported_events: reportedEvents,
        skipped_subscriptions: skippedSubscriptions,
        failures,
      },
    });
    if (auditError) console.error("Unable to write Stripe usage audit event");

    return jsonResponse(
      {
        success: failures === 0,
        date,
        reported_events: reportedEvents,
        skipped_subscriptions: skippedSubscriptions,
        failures,
      },
      failures === 0 ? 200 : 207,
    );
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error("report-usage failed");
    return jsonResponse(
      { error: status < 500 && error instanceof Error ? error.message : "Stripe usage reporting failed" },
      status,
    );
  }
});
