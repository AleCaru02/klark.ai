import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requireServiceRole,
} from "../_shared/security.ts";

interface AggregateRequest {
  date?: unknown;
}

interface TenantRow {
  id: string;
}

interface VoiceRow {
  connected_seconds: number | null;
}

interface MessageRow {
  category: string | null;
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

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
  }

  try {
    requireServiceRole(request);
    const payload = await request.json().catch(() => ({})) as AggregateRequest;
    const targetDate = parseDate(payload.date);
    const start = `${targetDate}T00:00:00.000Z`;
    const end = new Date(new Date(start).getTime() + 86_400_000).toISOString();
    const client = createServiceClient();

    const { data: tenantData, error: tenantError } = await client
      .from("tenants")
      .select("id");
    if (tenantError) throw tenantError;

    let processed = 0;
    let failures = 0;
    let totalVoiceSeconds = 0;
    let totalWhatsAppTemplates = 0;

    for (const tenant of (tenantData ?? []) as TenantRow[]) {
      try {
        const [voiceResult, messageResult] = await Promise.all([
          client
            .from("call_logs")
            .select("connected_seconds")
            .eq("tenant_id", tenant.id)
            .gte("created_at", start)
            .lt("created_at", end),
          client
            .from("message_logs")
            .select("category")
            .eq("tenant_id", tenant.id)
            .eq("channel", "whatsapp")
            .not("template_name", "is", null)
            .gte("created_at", start)
            .lt("created_at", end),
        ]);
        if (voiceResult.error) throw voiceResult.error;
        if (messageResult.error) throw messageResult.error;

        const voiceSeconds = ((voiceResult.data ?? []) as VoiceRow[]).reduce(
          (sum, row) => sum + Math.max(0, Number(row.connected_seconds ?? 0)),
          0,
        );
        const templateCounts = ((messageResult.data ?? []) as MessageRow[]).reduce<Record<string, number>>(
          (counts, row) => {
            const category = row.category?.trim().toLowerCase() || "utility";
            counts[category] = (counts[category] ?? 0) + 1;
            return counts;
          },
          {},
        );
        const whatsappTemplates = Object.values(templateCounts).reduce((sum, count) => sum + count, 0);

        const [voiceUpsert, whatsappUpsert] = await Promise.all([
          client.from("usage_voice_daily").upsert(
            { tenant_id: tenant.id, date: targetDate, connected_seconds: voiceSeconds },
            { onConflict: "tenant_id,date" },
          ),
          client.from("usage_wa_daily").upsert(
            { tenant_id: tenant.id, date: targetDate, template_counts_json: templateCounts },
            { onConflict: "tenant_id,date" },
          ),
        ]);
        if (voiceUpsert.error) throw voiceUpsert.error;
        if (whatsappUpsert.error) throw whatsappUpsert.error;

        processed += 1;
        totalVoiceSeconds += voiceSeconds;
        totalWhatsAppTemplates += whatsappTemplates;
      } catch {
        failures += 1;
        console.error("Usage aggregation failed for one tenant");
      }
    }

    const { error: auditError } = await client.from("audit_log").insert({
      tenant_id: null,
      action: "usage.aggregated",
      payload_json: {
        date: targetDate,
        processed,
        failures,
        total_voice_seconds: totalVoiceSeconds,
        total_whatsapp_templates: totalWhatsAppTemplates,
      },
    });
    if (auditError) console.error("Unable to write usage aggregation audit event");

    return jsonResponse({
      success: failures === 0,
      date: targetDate,
      processed,
      failures,
      total_voice_seconds: totalVoiceSeconds,
      total_whatsapp_templates: totalWhatsAppTemplates,
    }, failures === 0 ? 200 : 207);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error("aggregate-usage failed");
    return jsonResponse(
      { error: status < 500 && error instanceof Error ? error.message : "Usage aggregation failed" },
      status,
    );
  }
});
