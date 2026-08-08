import type { ServiceClient } from "./security.ts";

export interface TwilioCallContext {
  tenantId: string;
  contactId: string | null;
  queueId: string | null;
  direction: string;
}

export async function resolveExistingTwilioContext(
  supabase: ServiceClient,
  callSid: string,
  requestUrl: URL,
): Promise<TwilioCallContext | null> {
  const requestedQueueId = requestUrl.searchParams.get("queue_id");
  const requestedTenantId = requestUrl.searchParams.get("tenant_id");
  const requestedContactId = requestUrl.searchParams.get("contact_id");

  if (requestedQueueId) {
    const { data: queue, error } = await supabase
      .from("call_queue")
      .select("id,tenant_id,contact_id,last_call_sid")
      .eq("id", requestedQueueId)
      .maybeSingle();
    if (error) throw error;
    if (!queue) return null;
    if (queue.last_call_sid && queue.last_call_sid !== callSid) return null;
    if (requestedTenantId && requestedTenantId !== queue.tenant_id) return null;
    if (requestedContactId && requestedContactId !== queue.contact_id) return null;

    return {
      tenantId: queue.tenant_id as string,
      contactId: queue.contact_id as string,
      queueId: queue.id as string,
      direction: "outbound",
    };
  }

  const { data: callLog, error } = await supabase
    .from("call_logs")
    .select("tenant_id,contact_id,direction")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();
  if (error) throw error;
  if (!callLog?.tenant_id) return null;
  if (requestedTenantId && requestedTenantId !== callLog.tenant_id) return null;
  if (
    requestedContactId &&
    callLog.contact_id &&
    requestedContactId !== callLog.contact_id
  ) return null;

  return {
    tenantId: callLog.tenant_id as string,
    contactId: (callLog.contact_id as string | null) ?? null,
    queueId: null,
    direction: (callLog.direction as string | null) ?? "unknown",
  };
}

export async function resolveInboundTwilioContext(
  supabase: ServiceClient,
  callSid: string,
  from: string,
  to: string,
): Promise<TwilioCallContext | null> {
  const { data: phoneNumber, error: phoneError } = await supabase
    .from("tenant_phone_numbers")
    .select("tenant_id")
    .eq("phone_number", to)
    .eq("phone_type", "voice")
    .eq("status", "active")
    .maybeSingle();
  if (phoneError) throw phoneError;
  if (!phoneNumber?.tenant_id) return null;

  const tenantId = phoneNumber.tenant_id as string;
  const normalizedFrom = normalizeE164(from);
  if (!normalizedFrom) return null;

  const { data: existingContact, error: contactLookupError } = await supabase
    .from("contacts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("phone_e164", normalizedFrom)
    .maybeSingle();
  if (contactLookupError) throw contactLookupError;

  let contactId = existingContact?.id as string | undefined;
  if (!contactId) {
    const { data: contact, error: contactCreateError } = await supabase
      .from("contacts")
      .insert({
        tenant_id: tenantId,
        name: "Chiamata in entrata",
        phone_e164: normalizedFrom,
        last_activity_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (contactCreateError) throw contactCreateError;
    contactId = contact.id as string;

    const { error: sourceError } = await supabase.from("contact_sources").insert({
      tenant_id: tenantId,
      contact_id: contactId,
      source: "manual",
    });
    if (sourceError) throw sourceError;

    const { data: stage, error: stageError } = await supabase
      .from("stages")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (stageError) throw stageError;
    if (stage?.id) {
      const { error: assignmentError } = await supabase
        .from("contact_stages")
        .insert({ tenant_id: tenantId, contact_id: contactId, stage_id: stage.id });
      if (assignmentError) throw assignmentError;
    }
  }

  const { error: callLogError } = await supabase.from("call_logs").upsert({
    tenant_id: tenantId,
    contact_id: contactId,
    direction: "inbound",
    twilio_call_sid: callSid,
  }, { onConflict: "twilio_call_sid" });
  if (callLogError) throw callLogError;

  return { tenantId, contactId, queueId: null, direction: "inbound" };
}

export function xmlEscape(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&apos;",
    '"': "&quot;",
  })[character] ?? character);
}

export function twimlResponse(body: string, status = 200): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`,
    {
      status,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

export function gatherActionUrl(
  supabaseUrl: string,
  queueId: string | null,
): string {
  const url = new URL(`${supabaseUrl}/functions/v1/twilio-voice-gather`);
  if (queueId) url.searchParams.set("queue_id", queueId);
  return xmlEscape(url.toString());
}

function normalizeE164(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}
