import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requireUserTenant,
} from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function requireString(value: unknown, label: string, max: number): string {
  const cleaned = cleanText(value, max);
  if (!cleaned) throw new AuthError(`${label} is required`, 400);
  return cleaned;
}

function optionalE164(value: unknown): string | null {
  const cleaned = cleanText(value, 16);
  if (!cleaned) return null;
  if (!/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    throw new AuthError("Phone number must use E.164 format", 400);
  }
  return cleaned;
}

function integerInRange(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

async function loadConfiguration(client: ReturnType<typeof createServiceClient>, tenantId: string) {
  const [profile, settings, services, faqs, exceptions] = await Promise.all([
    client.from("tenant_business_profiles").select("*").eq("tenant_id", tenantId).maybeSingle(),
    client
      .from("settings")
      .select("timezone,language_voice,availability_json,booking_rules_json,recording_opt_in,do_not_contact_default,voice_number,voice_enabled,voice_runtime_verified,calendar_id,calendar_enabled")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    client.from("tenant_services").select("id,name,description,duration_minutes,price_cents,disclose_price,appointment_enabled,is_active,sort_order").eq("tenant_id", tenantId).order("sort_order"),
    client.from("tenant_faqs").select("id,question,answer,is_active,sort_order").eq("tenant_id", tenantId).order("sort_order"),
    client.from("tenant_schedule_exceptions").select("id,exception_date,is_closed,start_time,end_time,note").eq("tenant_id", tenantId).order("exception_date"),
  ]);

  for (const result of [profile, settings, services, faqs, exceptions]) {
    if (result.error) throw result.error;
  }

  return {
    profile: profile.data,
    settings: settings.data,
    services: services.data ?? [],
    faqs: faqs.data ?? [],
    exceptions: exceptions.data ?? [],
  };
}

async function saveProfile(
  client: ReturnType<typeof createServiceClient>,
  tenantId: string,
  profile: JsonRecord,
) {
  const countryCode = (cleanText(profile.country_code, 2) ?? "IT").toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new AuthError("Invalid country code", 400);
  const forwarding = cleanText(profile.forwarding_preference, 20) ?? "evaluate";
  if (!["evaluate", "none", "conditional", "always"].includes(forwarding)) {
    throw new AuthError("Invalid forwarding preference", 400);
  }
  const lineType = cleanText(profile.existing_line_type, 20);
  if (lineType && !["landline", "mobile", "voip", "pbx", "unknown"].includes(lineType)) {
    throw new AuthError("Invalid existing line type", 400);
  }

  const payload = {
    tenant_id: tenantId,
    address_line1: cleanText(profile.address_line1, 240),
    address_line2: cleanText(profile.address_line2, 240),
    city: cleanText(profile.city, 120),
    province: cleanText(profile.province, 120),
    postal_code: cleanText(profile.postal_code, 20),
    country_code: countryCode,
    business_phone_e164: optionalE164(profile.business_phone_e164),
    business_email: cleanText(profile.business_email, 254),
    website: cleanText(profile.website, 300),
    existing_phone_e164: optionalE164(profile.existing_phone_e164),
    existing_line_type: lineType,
    forwarding_preference: forwarding,
    callback_policy: cleanText(profile.callback_policy, 1500),
    escalation_policy: cleanText(profile.escalation_policy, 1500),
    outside_hours_behavior: cleanText(profile.outside_hours_behavior, 1000),
    ai_disclosure_confirmed: profile.ai_disclosure_confirmed === true,
    callback_consent_required: profile.callback_consent_required !== false,
    dnc_respected: profile.dnc_respected !== false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from("tenant_business_profiles").upsert(payload, { onConflict: "tenant_id" });
  if (error) throw error;
}

async function saveRuntime(
  client: ReturnType<typeof createServiceClient>,
  tenantId: string,
  body: JsonRecord,
) {
  const timezone = cleanText(body.timezone, 80) ?? "Europe/Rome";
  const language = cleanText(body.language_voice, 10) ?? "it";
  const availability = typeof body.availability_json === "object" && body.availability_json !== null
    ? body.availability_json
    : {};
  const suppliedRules = typeof body.booking_rules_json === "object" && body.booking_rules_json !== null
    ? body.booking_rules_json as JsonRecord
    : {};
  const bookingRules = {
    slot_duration_minutes: integerInRange(suppliedRules.slot_duration_minutes, 5, 480, 30),
    buffer_before_minutes: integerInRange(suppliedRules.buffer_before_minutes, 0, 240, 0),
    buffer_after_minutes: integerInRange(suppliedRules.buffer_after_minutes, 0, 240, 0),
    min_notice_hours: integerInRange(suppliedRules.min_notice_hours, 0, 720, 24),
    max_advance_days: integerInRange(suppliedRules.max_advance_days, 1, 730, 30),
  };

  const { error } = await client.from("settings").update({
    timezone,
    language_voice: language,
    availability_json: availability,
    booking_rules_json: bookingRules,
    recording_opt_in: body.recording_opt_in === true,
    do_not_contact_default: body.do_not_contact_default === true,
    updated_at: new Date().toISOString(),
  }).eq("tenant_id", tenantId);
  if (error) throw error;
}

async function replaceServices(
  client: ReturnType<typeof createServiceClient>,
  tenantId: string,
  rows: unknown,
) {
  if (!Array.isArray(rows) || rows.length > 100) throw new AuthError("Invalid services payload", 400);
  const payload = rows.map((row, index) => {
    const item = (row ?? {}) as JsonRecord;
    const price = item.price_cents === null || item.price_cents === undefined || item.price_cents === ""
      ? null
      : integerInRange(item.price_cents, 0, 100_000_000, 0);
    return {
      tenant_id: tenantId,
      name: requireString(item.name, "Service name", 160),
      description: cleanText(item.description, 3000),
      duration_minutes: item.duration_minutes ? integerInRange(item.duration_minutes, 5, 1440, 30) : null,
      price_cents: price,
      disclose_price: item.disclose_price === true,
      appointment_enabled: item.appointment_enabled === true,
      is_active: item.is_active !== false,
      sort_order: index,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: deleteError } = await client.from("tenant_services").delete().eq("tenant_id", tenantId);
  if (deleteError) throw deleteError;
  if (payload.length) {
    const { error } = await client.from("tenant_services").insert(payload);
    if (error) throw error;
  }
}

async function replaceFaqs(
  client: ReturnType<typeof createServiceClient>,
  tenantId: string,
  rows: unknown,
) {
  if (!Array.isArray(rows) || rows.length > 200) throw new AuthError("Invalid FAQ payload", 400);
  const payload = rows.map((row, index) => {
    const item = (row ?? {}) as JsonRecord;
    return {
      tenant_id: tenantId,
      question: requireString(item.question, "FAQ question", 500),
      answer: requireString(item.answer, "FAQ answer", 5000),
      is_active: item.is_active !== false,
      sort_order: index,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: deleteError } = await client.from("tenant_faqs").delete().eq("tenant_id", tenantId);
  if (deleteError) throw deleteError;
  if (payload.length) {
    const { error } = await client.from("tenant_faqs").insert(payload);
    if (error) throw error;
  }
}

async function replaceExceptions(
  client: ReturnType<typeof createServiceClient>,
  tenantId: string,
  rows: unknown,
) {
  if (!Array.isArray(rows) || rows.length > 100) throw new AuthError("Invalid exceptions payload", 400);
  const payload = rows.map((row) => {
    const item = (row ?? {}) as JsonRecord;
    const date = requireString(item.exception_date, "Exception date", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AuthError("Invalid exception date", 400);
    const isClosed = item.is_closed !== false;
    return {
      tenant_id: tenantId,
      exception_date: date,
      is_closed: isClosed,
      start_time: isClosed ? null : cleanText(item.start_time, 8),
      end_time: isClosed ? null : cleanText(item.end_time, 8),
      note: cleanText(item.note, 500),
      updated_at: new Date().toISOString(),
    };
  });

  const { error: deleteError } = await client.from("tenant_schedule_exceptions").delete().eq("tenant_id", tenantId);
  if (deleteError) throw deleteError;
  if (payload.length) {
    const { error } = await client.from("tenant_schedule_exceptions").insert(payload);
    if (error) throw error;
  }
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);

  const client = createServiceClient();
  try {
    const { tenantId } = await requireUserTenant(request, client);
    const body = await request.json().catch(() => ({})) as JsonRecord;
    const action = cleanText(body.action, 40) ?? "get";

    if (action === "get") {
      return jsonResponse(await loadConfiguration(client, tenantId), 200, corsHeaders);
    }
    if (action === "save_profile") {
      await saveProfile(client, tenantId, (body.profile ?? {}) as JsonRecord);
    } else if (action === "save_runtime") {
      await saveRuntime(client, tenantId, body);
    } else if (action === "replace_services") {
      await replaceServices(client, tenantId, body.services);
    } else if (action === "replace_faqs") {
      await replaceFaqs(client, tenantId, body.faqs);
    } else if (action === "replace_exceptions") {
      await replaceExceptions(client, tenantId, body.exceptions);
    } else {
      throw new AuthError("Unsupported action", 400);
    }

    return jsonResponse({ ok: true }, 200, corsHeaders);
  } catch (error) {
    if (error instanceof AuthError) return jsonResponse({ error: error.message }, error.status, corsHeaders);
    console.error("Onboarding configuration request failed");
    return jsonResponse({ error: "Unable to update onboarding configuration" }, 500, corsHeaders);
  }
});
