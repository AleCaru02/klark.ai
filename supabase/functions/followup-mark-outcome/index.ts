import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireUserTenant,
} from "../_shared/security.ts";

type Channel = "call" | "whatsapp" | "manual";
type Outcome =
  | "answered"
  | "no_answer"
  | "busy"
  | "opt_out"
  | "appointment_set"
  | "lost"
  | "rescheduled"
  | "cancelled";

interface OutcomeRequest {
  lead_id?: unknown;
  channel?: unknown;
  outcome?: unknown;
  content?: unknown;
  notes?: unknown;
}

interface LeadRow {
  id: string;
  notes: string | null;
  handoff_status: string | null;
}

const outcomeToStatus: Record<Outcome, string> = {
  answered: "IN_CONVO",
  no_answer: "NO_ANSWER",
  busy: "NO_ANSWER",
  opt_out: "DO_NOT_CONTACT",
  appointment_set: "APPOINTMENT_SET",
  lost: "LOST",
  rescheduled: "IN_CONVO",
  cancelled: "IN_CONVO",
};

const channels = new Set<Channel>(["call", "whatsapp", "manual"]);
const outcomes = new Set<Outcome>(Object.keys(outcomeToStatus) as Outcome[]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function corsHeaders(request: Request): Record<string, string> {
  const appUrl = requiredEnv("APP_URL").replace(/\/$/, "");
  const allowed = new Set([
    appUrl,
    ...(Deno.env.get("ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean),
  ]);
  const origin = request.headers.get("Origin")?.replace(/\/$/, "");
  return {
    "Access-Control-Allow-Origin": origin && allowed.has(origin) ? origin : appUrl,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new AuthError("Invalid text value", 400);
  return value.trim().slice(0, maxLength) || null;
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { ...headers, Allow: "POST" });
  }

  try {
    const client = createServiceClient();
    const caller = await requireUserTenant(request, client);
    const payload = await request.json().catch(() => ({})) as OutcomeRequest;
    if (typeof payload.lead_id !== "string" || !uuidPattern.test(payload.lead_id)) {
      throw new AuthError("Invalid lead ID", 400);
    }
    if (typeof payload.channel !== "string" || !channels.has(payload.channel as Channel)) {
      throw new AuthError("Invalid channel", 400);
    }
    if (typeof payload.outcome !== "string" || !outcomes.has(payload.outcome as Outcome)) {
      throw new AuthError("Invalid outcome", 400);
    }

    const channel = payload.channel as Channel;
    const outcome = payload.outcome as Outcome;
    const content = boundedText(payload.content, 2_000);
    const notes = boundedText(payload.notes, 2_000);

    const { data: leadData, error: leadError } = await client
      .from("leads")
      .select("id,notes,handoff_status")
      .eq("id", payload.lead_id)
      .eq("tenant_id", caller.tenantId)
      .maybeSingle();
    if (leadError) throw leadError;
    if (!leadData) throw new AuthError("Lead not found", 404);
    const lead = leadData as LeadRow;

    const now = new Date();
    const newStatus = outcomeToStatus[outcome];
    const terminal = ["DO_NOT_CONTACT", "LOST", "APPOINTMENT_SET"].includes(newStatus);

    let retryMinutes = 240;
    if (!terminal) {
      const { data: rules, error: rulesError } = await client
        .from("followup_rules")
        .select("retry_after_no_answer_minutes")
        .eq("tenant_id", caller.tenantId)
        .maybeSingle();
      if (rulesError) throw rulesError;
      retryMinutes = Math.min(10_080, Math.max(15, Number(rules?.retry_after_no_answer_minutes ?? 240)));
    }
    const nextActionAt = terminal || lead.handoff_status === "HUMAN"
      ? null
      : new Date(now.getTime() + retryMinutes * 60_000).toISOString();

    const interactionResult = await client.from("interactions").insert({
      tenant_id: caller.tenantId,
      lead_id: lead.id,
      channel,
      direction: "out",
      content: content ?? `Esito registrato: ${outcome}`,
      outcome,
      meta: { marked_via: "followup-mark-outcome", actor_user_id: caller.userId },
    });
    if (interactionResult.error) throw interactionResult.error;

    const nextNotes = notes
      ? [lead.notes, `[${now.toISOString()}] ${notes}`].filter(Boolean).join("\n\n")
      : lead.notes;
    const updateResult = await client
      .from("leads")
      .update({
        status: newStatus,
        last_contact_at: now.toISOString(),
        next_action_at: nextActionAt,
        notes: nextNotes,
      })
      .eq("id", lead.id)
      .eq("tenant_id", caller.tenantId)
      .select("id")
      .maybeSingle();
    if (updateResult.error) throw updateResult.error;
    if (!updateResult.data) throw new Error("Lead update failed");

    if (terminal) {
      const { error: cancelError } = await client
        .from("followup_queue")
        .update({ status: "CANCELLED" })
        .eq("tenant_id", caller.tenantId)
        .eq("lead_id", lead.id)
        .eq("status", "PENDING");
      if (cancelError) throw cancelError;
    }

    const { error: auditError } = await client.from("audit_log").insert({
      tenant_id: caller.tenantId,
      actor_user_id: caller.userId,
      action: "followup.outcome_marked",
      payload_json: { channel, outcome, new_status: newStatus, next_action_scheduled: Boolean(nextActionAt) },
    });
    if (auditError) console.error("Unable to write follow-up outcome audit event");

    return jsonResponse(
      { success: true, new_status: newStatus, next_action_at: nextActionAt },
      200,
      headers,
    );
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error("followup-mark-outcome failed");
    return jsonResponse(
      { error: status < 500 && error instanceof Error ? error.message : "Unable to save outcome" },
      status,
      headers,
    );
  }
});
