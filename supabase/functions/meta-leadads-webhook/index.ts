import {
  constantTimeEqual,
  createServiceClient,
  jsonResponse,
  markProviderEventFailed,
  markProviderEventProcessed,
  registerProviderEvent,
  requiredEnv,
  sha256Hex,
  verifyMetaSignature,
} from "../_shared/security.ts";

interface FacebookLeadField {
  name: string;
  values: string[];
}

interface FacebookLeadData {
  id: string;
  created_time: string;
  field_data?: FacebookLeadField[];
}

interface LeadgenChange {
  field: string;
  value: {
    ad_id?: string;
    form_id: string;
    leadgen_id: string;
    created_time: number;
    page_id: string;
  };
}

interface WebhookPayload {
  object?: string;
  entry?: Array<{
    id: string;
    time: number;
    changes?: LeadgenChange[];
  }>;
}

Deno.serve(async (request) => {
  const url = new URL(request.url);

  if (request.method === "GET") {
    const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN")?.trim();
    if (!verifyToken) return new Response("Webhook unavailable", { status: 503 });

    const mode = url.searchParams.get("hub.mode");
    const supplied = url.searchParams.get("hub.verify_token") ?? "";
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    if (mode === "subscribe" && constantTimeEqual(supplied, verifyToken)) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
      });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "GET, POST" });
  }

  let appSecret: string;
  try {
    appSecret = requiredEnv("META_APP_SECRET");
  } catch (error) {
    console.error("[meta-leadads-webhook] App secret is unavailable", error);
    return jsonResponse({ error: "Webhook unavailable" }, 503);
  }

  const rawBody = await request.text();
  if (
    !(await verifyMetaSignature(
      rawBody,
      request.headers.get("x-hub-signature-256"),
      appSecret,
    ))
  ) {
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }
  if (payload.object !== "page") {
    return jsonResponse({ received: true, ignored: true });
  }

  const supabase = createServiceClient();
  const payloadDigest = await sha256Hex(rawBody);
  const results: Array<{ leadgen_id: string; status: string }> = [];

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "leadgen") continue;

        const leadgenId = change.value.leadgen_id;
        const pageId = change.value.page_id || entry.id;
        const formId = change.value.form_id;
        if (!leadgenId || !pageId || !formId) continue;

        const { data: integration, error: integrationError } = await supabase
          .from("facebook_integrations")
          .select("tenant_id,access_token")
          .eq("page_id", pageId)
          .maybeSingle();
        if (integrationError) throw integrationError;
        if (!integration?.tenant_id || !integration?.access_token) {
          console.warn("[meta-leadads-webhook] Unknown page", { page_id: pageId });
          results.push({ leadgen_id: leadgenId, status: "ignored" });
          continue;
        }

        const tenantId = integration.tenant_id as string;
        const registration = await registerProviderEvent(
          supabase,
          "meta_leadads",
          leadgenId,
          "leadgen.created",
          payloadDigest,
          tenantId,
        );
        if (registration.duplicate) {
          results.push({ leadgen_id: leadgenId, status: "duplicate" });
          continue;
        }

        try {
          const lead = await fetchLeadFromFacebook(
            leadgenId,
            integration.access_token as string,
          );
          await importLead(supabase, tenantId, leadgenId, formId, pageId, lead);
          await markProviderEventProcessed(supabase, registration.id!);
          results.push({ leadgen_id: leadgenId, status: "imported" });
        } catch (error) {
          await markProviderEventFailed(
            supabase,
            registration.id!,
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        }
      }
    }

    return jsonResponse({ received: true, results });
  } catch (error) {
    console.error("[meta-leadads-webhook] Processing failed", error);
    return jsonResponse({ error: "Webhook processing failed" }, 500);
  }
});

async function fetchLeadFromFacebook(
  leadgenId: string,
  accessToken: string,
): Promise<FacebookLeadData> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${encodeURIComponent(leadgenId)}?fields=id,created_time,field_data`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    console.error("[meta-leadads-webhook] Graph API rejected lead", {
      status: response.status,
      leadgen_id: leadgenId,
    });
    throw new Error(`Meta Graph API error ${response.status}`);
  }
  return await response.json() as FacebookLeadData;
}

async function importLead(
  supabase: any,
  tenantId: string,
  leadgenId: string,
  formId: string,
  pageId: string,
  leadData: FacebookLeadData,
) {
  const { data: existingImport, error: importLookupError } = await supabase
    .from("facebook_lead_imports")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("leadgen_id", leadgenId)
    .maybeSingle();
  if (importLookupError) throw importLookupError;
  if (existingImport) return;

  const form = await ensureForm(supabase, tenantId, formId, pageId);
  const parsed = parseLeadFields(leadData.field_data ?? [], leadgenId);
  const contactId = await findOrCreateContact(
    supabase,
    tenantId,
    parsed,
    form.is_active !== true,
  );

  const { error: answersError } = await supabase.from("lead_form_answers").insert({
    tenant_id: tenantId,
    contact_id: contactId,
    form_provider: "facebook",
    form_id: formId,
    answers_json: parsed.fields,
  });
  if (answersError) throw answersError;

  const { error: importError } = await supabase.from("facebook_lead_imports").insert({
    tenant_id: tenantId,
    contact_id: contactId,
    leadgen_id: leadgenId,
    form_id: formId,
    page_id: pageId,
    raw_data: leadData,
  });
  if (importError?.code !== "23505" && importError) throw importError;

  const { error: formUpdateError } = await supabase
    .from("facebook_forms")
    .update({
      last_lead_at: new Date().toISOString(),
      lead_count: Number(form.lead_count ?? 0) + 1,
    })
    .eq("tenant_id", tenantId)
    .eq("id", form.id);
  if (formUpdateError) throw formUpdateError;
}

async function ensureForm(
  supabase: any,
  tenantId: string,
  formId: string,
  pageId: string,
) {
  const { data: existing, error: lookupError } = await supabase
    .from("facebook_forms")
    .select("id,is_active,lead_count")
    .eq("tenant_id", tenantId)
    .eq("external_form_id", formId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from("facebook_forms")
    .insert({
      tenant_id: tenantId,
      external_form_id: formId,
      page_id: pageId,
      first_seen_at: new Date().toISOString(),
      lead_count: 0,
      is_active: false,
    })
    .select("id,is_active,lead_count")
    .single();
  if (createError) throw createError;
  return created;
}

function parseLeadFields(fields: FacebookLeadField[], leadgenId: string) {
  const answers: Record<string, string> = {};
  let name = "";
  let email = "";
  let phone = "";

  for (const field of fields) {
    const value = field.values?.[0]?.trim() || "";
    answers[field.name] = value;
    const key = field.name.toLowerCase();
    if (!name && (key === "full_name" || key.includes("name"))) name = value;
    if (!email && key.includes("email")) email = value.toLowerCase();
    if (!phone && (key.includes("phone") || key.includes("tel"))) phone = value;
  }

  return {
    fields: answers,
    name: name.slice(0, 160) || `Lead Facebook ${leadgenId.slice(-6)}`,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    phoneE164: normalizeE164(phone),
  };
}

async function findOrCreateContact(
  supabase: any,
  tenantId: string,
  lead: {
    fields: Record<string, string>;
    name: string;
    email: string | null;
    phoneE164: string | null;
  },
  fromInactiveForm: boolean,
): Promise<string> {
  let existing: { id: string } | null = null;
  if (lead.email) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", lead.email)
      .maybeSingle();
    if (error) throw error;
    existing = data;
  }
  if (!existing && lead.phoneE164) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("phone_e164", lead.phoneE164)
      .maybeSingle();
    if (error) throw error;
    existing = data;
  }

  if (existing) {
    const { error } = await supabase
      .from("contacts")
      .update({
        last_activity_at: new Date().toISOString(),
        from_inactive_form: fromInactiveForm,
      })
      .eq("tenant_id", tenantId)
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      tenant_id: tenantId,
      name: lead.name,
      email: lead.email,
      phone_e164: lead.phoneE164,
      last_activity_at: new Date().toISOString(),
      from_inactive_form: fromInactiveForm,
    })
    .select("id")
    .single();
  if (contactError) throw contactError;

  const { error: sourceError } = await supabase.from("contact_sources").insert({
    tenant_id: tenantId,
    contact_id: contact.id,
    source: "facebook_leadads",
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
  if (stage) {
    const { error: assignmentError } = await supabase.from("contact_stages").insert({
      tenant_id: tenantId,
      contact_id: contact.id,
      stage_id: stage.id,
    });
    if (assignmentError) throw assignmentError;
  }

  return contact.id;
}

function normalizeE164(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }
  if (trimmed.startsWith("00") && digits.length >= 10 && digits.length <= 17) {
    return `+${digits.slice(2)}`;
  }
  return null;
}
