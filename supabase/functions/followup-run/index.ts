import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireServiceRole,
} from "../_shared/security.ts";

interface RunRequest {
  tenant_id?: unknown;
  lead_id?: unknown;
  limit?: unknown;
}

interface LeadRow {
  id: string;
  tenant_id: string;
  status: string;
  priority_score: number | null;
  tags: string[] | null;
  handoff_status: string | null;
}

interface RulesRow {
  daily_call_window_start: string;
  daily_call_window_end: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

interface SettingsRow {
  voice_enabled: boolean | null;
  whatsapp_enabled: boolean | null;
  twilio_number_sid: string | null;
  whatsapp_phone_number_id: string | null;
  timezone: string | null;
}

interface AiAction {
  next_action: "CALL" | "WHATSAPP" | "WAIT" | "CLOSE";
  planned_delay_minutes: number;
  call_script?: unknown;
  whatsapp_message?: unknown;
  crm_updates?: {
    status?: unknown;
    priority_score_delta?: unknown;
    tags_add?: unknown;
    tags_remove?: unknown;
  };
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedActions = new Set(["CALL", "WHATSAPP", "WAIT", "CLOSE"]);

function parseOptionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new AuthError(`Invalid ${field}`, 400);
  }
  return value;
}

function parseLimit(value: unknown): number {
  if (value === undefined || value === null) return 25;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new AuthError("Invalid limit", 400);
  }
  return parsed;
}

function parseTime(value: string, fallback: string): number {
  const match = value?.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  const source = match ? value : fallback;
  const [hour, minute] = source.split(":").map(Number);
  return hour * 60 + minute;
}

function localMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function inRange(minutes: number, start: number, end: number): boolean {
  return start <= end
    ? minutes >= start && minutes < end
    : minutes >= start || minutes < end;
}

function normalizePlannedAt(
  candidate: Date,
  rules: RulesRow,
  timeZone: string,
  action: AiAction["next_action"],
): Date {
  if (action !== "CALL" && action !== "WHATSAPP") return candidate;
  const callStart = parseTime(rules.daily_call_window_start, "09:00");
  const callEnd = parseTime(rules.daily_call_window_end, "19:00");
  const quietStart = parseTime(rules.quiet_hours_start, "21:00");
  const quietEnd = parseTime(rules.quiet_hours_end, "08:00");

  const next = new Date(candidate);
  for (let index = 0; index < 96; index += 1) {
    const minutes = localMinutes(next, timeZone);
    const inWindow = inRange(minutes, callStart, callEnd);
    const inQuietHours = inRange(minutes, quietStart, quietEnd);
    if (inWindow && !inQuietHours) return next;
    next.setUTCMinutes(next.getUTCMinutes() + 30);
  }
  throw new Error("Unable to find an allowed follow-up window");
}

function parseAiAction(value: unknown): AiAction {
  if (!value || typeof value !== "object") throw new Error("Invalid AI response");
  const source = value as Record<string, unknown>;
  if (typeof source.next_action !== "string" || !allowedActions.has(source.next_action)) {
    throw new Error("Invalid AI action");
  }
  const delay = Number(source.planned_delay_minutes ?? 0);
  if (!Number.isFinite(delay) || delay < 0 || delay > 10_080) {
    throw new Error("Invalid AI delay");
  }
  return {
    next_action: source.next_action as AiAction["next_action"],
    planned_delay_minutes: Math.round(delay),
    call_script: source.call_script,
    whatsapp_message: source.whatsapp_message,
    crm_updates: source.crm_updates as AiAction["crm_updates"],
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 100))
    : [];
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
  }

  try {
    requireServiceRole(request);
    const payload = await request.json().catch(() => ({})) as RunRequest;
    const tenantId = parseOptionalUuid(payload.tenant_id, "tenant ID");
    const leadId = parseOptionalUuid(payload.lead_id, "lead ID");
    const limit = parseLimit(payload.limit);
    if (leadId && !tenantId) throw new AuthError("tenant_id is required with lead_id", 400);

    const client = createServiceClient();
    let leadQuery = client
      .from("leads")
      .select("id,tenant_id,status,priority_score,tags,handoff_status")
      .in("status", ["NEW", "TO_CALL", "NO_ANSWER", "IN_CONVO"])
      .neq("handoff_status", "HUMAN")
      .lte("next_action_at", new Date().toISOString())
      .order("priority_score", { ascending: false })
      .limit(limit);
    if (tenantId) leadQuery = leadQuery.eq("tenant_id", tenantId);
    if (leadId) leadQuery = leadQuery.eq("id", leadId);

    const { data: leadData, error: leadError } = await leadQuery;
    if (leadError) throw leadError;

    let queued = 0;
    let deferred = 0;
    let closed = 0;
    let skipped = 0;
    let failures = 0;

    for (const lead of (leadData ?? []) as LeadRow[]) {
      try {
        const { data: pending, error: pendingError } = await client
          .from("followup_queue")
          .select("id")
          .eq("tenant_id", lead.tenant_id)
          .eq("lead_id", lead.id)
          .eq("status", "PENDING")
          .limit(1)
          .maybeSingle();
        if (pendingError) throw pendingError;
        if (pending) {
          skipped += 1;
          continue;
        }

        const [settingsResult, rulesResult] = await Promise.all([
          client
            .from("settings")
            .select("voice_enabled,whatsapp_enabled,twilio_number_sid,whatsapp_phone_number_id,timezone")
            .eq("tenant_id", lead.tenant_id)
            .maybeSingle(),
          client
            .from("followup_rules")
            .select("daily_call_window_start,daily_call_window_end,quiet_hours_start,quiet_hours_end")
            .eq("tenant_id", lead.tenant_id)
            .maybeSingle(),
        ]);
        if (settingsResult.error) throw settingsResult.error;
        if (rulesResult.error) throw rulesResult.error;
        if (!settingsResult.data) throw new Error("Tenant settings not found");

        const response = await fetch(`${requiredEnv("SUPABASE_URL")}/functions/v1/ai-next-best-action`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${requiredEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tenant_id: lead.tenant_id, lead_id: lead.id }),
        });
        if (!response.ok) throw new Error(`AI action failed with status ${response.status}`);
        const action = parseAiAction(await response.json());
        const settings = settingsResult.data as SettingsRow;
        const rules = (rulesResult.data ?? {
          daily_call_window_start: "09:00",
          daily_call_window_end: "19:00",
          quiet_hours_start: "21:00",
          quiet_hours_end: "08:00",
        }) as RulesRow;

        if (action.next_action === "CLOSE") {
          const { error: closeError } = await client
            .from("leads")
            .update({ status: "LOST", next_action_at: null })
            .eq("id", lead.id)
            .eq("tenant_id", lead.tenant_id);
          if (closeError) throw closeError;
          closed += 1;
          continue;
        }

        const candidate = new Date(Date.now() + action.planned_delay_minutes * 60_000);
        const plannedAt = normalizePlannedAt(candidate, rules, settings.timezone || "Europe/Rome", action.next_action);

        if (action.next_action === "WAIT") {
          const { error: deferError } = await client
            .from("leads")
            .update({ next_action_at: plannedAt.toISOString() })
            .eq("id", lead.id)
            .eq("tenant_id", lead.tenant_id);
          if (deferError) throw deferError;
          deferred += 1;
          continue;
        }

        const channelReady = action.next_action === "CALL"
          ? settings.voice_enabled === true && Boolean(settings.twilio_number_sid)
          : settings.whatsapp_enabled === true && Boolean(settings.whatsapp_phone_number_id);
        if (!channelReady) {
          const retryAt = new Date(Date.now() + 60 * 60_000).toISOString();
          const { error: deferError } = await client
            .from("leads")
            .update({ next_action_at: retryAt })
            .eq("id", lead.id)
            .eq("tenant_id", lead.tenant_id);
          if (deferError) throw deferError;
          deferred += 1;
          await client.from("audit_log").insert({
            tenant_id: lead.tenant_id,
            action: "followup.channel_not_ready",
            payload_json: { action: action.next_action },
          });
          continue;
        }

        const tags = new Set(lead.tags ?? []);
        const crmUpdates = action.crm_updates ?? {};
        for (const tag of stringArray(crmUpdates.tags_add)) tags.add(tag);
        for (const tag of stringArray(crmUpdates.tags_remove)) tags.delete(tag);
        const priorityDelta = Number(crmUpdates.priority_score_delta ?? 0);
        const priority = Math.min(100, Math.max(0, Number(lead.priority_score ?? 0) + (Number.isFinite(priorityDelta) ? priorityDelta : 0)));
        const requestedStatus = typeof crmUpdates.status === "string" ? crmUpdates.status : lead.status;
        const safeStatus = ["NEW", "TO_CALL", "NO_ANSWER", "IN_CONVO", "APPOINTMENT_SET", "LOST"].includes(requestedStatus)
          ? requestedStatus
          : lead.status;

        const queueResult = await client.from("followup_queue").insert({
          tenant_id: lead.tenant_id,
          lead_id: lead.id,
          action_type: action.next_action,
          planned_at: plannedAt.toISOString(),
          status: "PENDING",
          attempt_no: 1,
          reason: "AI next-best-action",
          payload: {
            call_script: action.next_action === "CALL" ? action.call_script ?? null : null,
            whatsapp_message: action.next_action === "WHATSAPP" && typeof action.whatsapp_message === "string"
              ? action.whatsapp_message.slice(0, 1_000)
              : null,
          },
        });
        if (queueResult.error) throw queueResult.error;

        const updateResult = await client
          .from("leads")
          .update({
            status: safeStatus,
            priority_score: priority,
            tags: [...tags],
            next_action_at: plannedAt.toISOString(),
          })
          .eq("id", lead.id)
          .eq("tenant_id", lead.tenant_id);
        if (updateResult.error) throw updateResult.error;
        queued += 1;
      } catch {
        failures += 1;
        console.error("Follow-up planning failed for one lead");
      }
    }

    const { error: auditError } = await client.from("audit_log").insert({
      tenant_id: tenantId,
      action: "followup.run_completed",
      payload_json: { queued, deferred, closed, skipped, failures },
    });
    if (auditError) console.error("Unable to write follow-up run audit event");

    return jsonResponse(
      { success: failures === 0, queued, deferred, closed, skipped, failures },
      failures === 0 ? 200 : 207,
    );
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error("followup-run failed");
    return jsonResponse(
      { error: status < 500 && error instanceof Error ? error.message : "Follow-up run failed" },
      status,
    );
  }
});
