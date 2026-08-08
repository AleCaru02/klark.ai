import {
  requireActiveTenant,
  type ServiceClient,
} from "./security.ts";

export interface TwilioCallContext {
  tenantId: string;
  contactId: string | null;
  queueId: string | null;
  direction: string;
  callSid: string;
  testMode: boolean;
}

interface CachedTwilioToken {
  token: string;
  expiresAt: number;
}

const subaccountTokenCache = new Map<string, CachedTwilioToken>();
const SUBACCOUNT_TOKEN_CACHE_MS = 5 * 60 * 1000;

export async function resolveTwilioWebhookAuthToken(
  supabase: ServiceClient,
  form: URLSearchParams,
): Promise<string | null> {
  const accountSid = (form.get("AccountSid") ?? "").trim();
  const parentAccountSid = (Deno.env.get("TWILIO_ACCOUNT_SID") ?? "").trim();
  const parentAuthToken = (Deno.env.get("TWILIO_AUTH_TOKEN") ?? "").trim();
  if (!accountSid || !parentAccountSid || !parentAuthToken) return null;

  if (accountSid === parentAccountSid) return parentAuthToken;
  if (!/^AC[0-9A-Fa-f]{32}$/.test(accountSid)) return null;

  const { data: tenantPhone, error: tenantPhoneError } = await supabase
    .from("tenant_phone_numbers")
    .select("id")
    .eq("phone_type", "voice")
    .eq("twilio_subaccount_sid", accountSid)
    .limit(1)
    .maybeSingle();
  if (tenantPhoneError) throw tenantPhoneError;
  if (!tenantPhone) return null;

  const cached = subaccountTokenCache.get(accountSid);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${btoa(`${parentAccountSid}:${parentAuthToken}`)}`,
      },
    },
  );
  if (!response.ok) {
    console.error("[twilio-voice] Unable to resolve subaccount auth token", {
      account_sid: accountSid,
      status: response.status,
    });
    return null;
  }

  const payload = await response.json() as { auth_token?: string };
  const token = typeof payload.auth_token === "string" ? payload.auth_token.trim() : "";
  if (!token) return null;
  subaccountTokenCache.set(accountSid, {
    token,
    expiresAt: Date.now() + SUBACCOUNT_TOKEN_CACHE_MS,
  });
  return token;
}

export async function resolveExistingTwilioContext(
  supabase: ServiceClient,
  callSid: string,
  requestUrl: URL,
): Promise<TwilioCallContext | null> {
  const requestedQueueId = requestUrl.searchParams.get("queue_id");
  const requestedTenantId = requestUrl.searchParams.get("tenant_id");
  const requestedContactId = requestUrl.searchParams.get("contact_id");
  const requestedTestMode = requestUrl.searchParams.get("test_mode") === "1";

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
      callSid,
      testMode: false,
    };
  }

  const { data: callLog, error } = await supabase
    .from("call_logs")
    .select("tenant_id,contact_id,direction,outcome_json")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();
  if (error) throw error;
  if (callLog?.tenant_id) {
    if (requestedTenantId && requestedTenantId !== callLog.tenant_id) return null;
    if (
      requestedContactId &&
      callLog.contact_id &&
      requestedContactId !== callLog.contact_id
    ) return null;
    const outcome = isRecord(callLog.outcome_json) ? callLog.outcome_json : {};
    return {
      tenantId: callLog.tenant_id as string,
      contactId: (callLog.contact_id as string | null) ?? null,
      queueId: null,
      direction: (callLog.direction as string | null) ?? "unknown",
      callSid,
      testMode: outcome.test_mode === true,
    };
  }

  // The first Twilio webhook can race the call-log insert. The URL is signed by
  // Twilio, so the tenant/contact values can be used after verifying membership.
  if (requestedTenantId && requestedContactId) {
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("tenant_id", requestedTenantId)
      .eq("id", requestedContactId)
      .maybeSingle();
    if (contactError) throw contactError;
    if (!contact) return null;
    return {
      tenantId: requestedTenantId,
      contactId: requestedContactId,
      queueId: null,
      direction: "outbound",
      callSid,
      testMode: requestedTestMode,
    };
  }

  return null;
}

export async function resolveInboundTwilioContext(
  supabase: ServiceClient,
  callSid: string,
  from: string,
  to: string,
): Promise<TwilioCallContext | null> {
  const { data: phoneNumber, error: phoneError } = await supabase
    .from("tenant_phone_numbers")
    .select("tenant_id,status,provider_status,regulatory_status,regulatory_verified_at")
    .eq("phone_number", to)
    .eq("phone_type", "voice")
    .eq("provider_status", "verified")
    .in("status", ["pending", "active"])
    .maybeSingle();
  if (phoneError) throw phoneError;
  if (!phoneNumber?.tenant_id) return null;
  if (phoneNumber.regulatory_status !== "approved" || !phoneNumber.regulatory_verified_at) {
    return null;
  }

  const tenantId = phoneNumber.tenant_id as string;
  try {
    await requireActiveTenant(supabase, tenantId);
  } catch {
    return null;
  }

  const { data: settings, error: settingsError } = await supabase
    .from("settings")
    .select("voice_enabled,voice_runtime_verified,voice_test_mode")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (settingsError) throw settingsError;

  const testMode = phoneNumber.status !== "active";
  if (testMode) {
    if (settings?.voice_test_mode !== true) return null;
  } else if (settings?.voice_enabled !== true || settings?.voice_runtime_verified !== true) {
    return null;
  }

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
    outcome_json: {
      test_mode: testMode,
      recording_requested: false,
    },
  }, { onConflict: "twilio_call_sid" });
  if (callLogError) throw callLogError;

  return {
    tenantId,
    contactId,
    queueId: null,
    direction: "inbound",
    callSid,
    testMode,
  };
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
  testMode = false,
): string {
  const url = new URL(`${supabaseUrl}/functions/v1/twilio-voice-gather`);
  if (queueId) url.searchParams.set("queue_id", queueId);
  if (testMode) url.searchParams.set("test_mode", "1");
  return xmlEscape(url.toString());
}

function normalizeE164(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
