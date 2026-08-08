import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireUserTenant,
} from "../_shared/security.ts";

interface PullRequest { since?: unknown }
interface MetaField { name?: string; values?: unknown[] }
interface MetaLead { id?: string; created_time?: string; field_data?: MetaField[] }

function corsHeaders(request: Request): Record<string, string> {
  const appUrl = requiredEnv("APP_URL").replace(/\/$/, "");
  const allowed = new Set([appUrl, ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim().replace(/\/$/, "")).filter(Boolean)]);
  const origin = request.headers.get("Origin")?.replace(/\/$/, "");
  return {
    "Access-Control-Allow-Origin": origin && allowed.has(origin) ? origin : appUrl,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function graphVersion(): string {
  const value = requiredEnv("META_GRAPH_API_VERSION");
  if (!/^v\d+\.\d+$/.test(value)) throw new Error("Invalid Meta API version");
  return value;
}

function parseSince(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new AuthError("Invalid since value", 400);
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp > Date.now()) throw new AuthError("Invalid since value", 400);
  return Math.floor(timestamp / 1000);
}

function normalizePhone(value: string): string | null {
  const cleaned = value.replace(/[^+\d]/g, "");
  if (!cleaned) return null;
  const candidate = cleaned.startsWith("+") ? cleaned : `+39${cleaned}`;
  return /^\+[1-9]\d{7,14}$/.test(candidate) ? candidate : null;
}

function fieldMap(lead: MetaLead): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of lead.field_data ?? []) {
    if (typeof field.name !== "string") continue;
    const value = Array.isArray(field.values) && typeof field.values[0] === "string"
      ? field.values[0].slice(0, 1_000)
      : "";
    result[field.name.slice(0, 200)] = value;
  }
  return result;
}

function firstMatching(fields: Record<string, string>, patterns: RegExp[]): string {
  for (const [key, value] of Object.entries(fields)) {
    if (patterns.some((pattern) => pattern.test(key.toLowerCase()))) return value.trim();
  }
  return "";
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, { ...headers, Allow: "POST" });

  try {
    const client = createServiceClient();
    const caller = await requireUserTenant(request, client);
    const payload = await request.json().catch(() => ({})) as PullRequest;
    const since = parseSince(payload.since);

    const { data: integration, error: integrationError } = await client
      .from("facebook_integrations")
      .select("page_id,form_id,access_token,token_expires_at")
      .eq("tenant_id", caller.tenantId)
      .maybeSingle();
    if (integrationError) throw integrationError;
    if (!integration?.access_token) return jsonResponse({ connected: false, imported: 0, skipped: 0, failed: 0 }, 200, headers);
    if (!integration.form_id) throw new AuthError("Select a Meta lead form before importing", 409);
    if (integration.token_expires_at && new Date(integration.token_expires_at).getTime() <= Date.now() + 300_000) {
      throw new AuthError("Meta authorization has expired", 409);
    }

    const url = new URL(`https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(integration.form_id)}/leads`);
    url.searchParams.set("limit", "50");
    url.searchParams.set("fields", "id,created_time,field_data");
    if (since !== null) {
      url.searchParams.set("filtering", JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]));
    }
    const metaResponse = await fetch(url, { headers: { Authorization: `Bearer ${integration.access_token}` } });
    const metaBody = await metaResponse.json().catch(() => ({})) as { data?: MetaLead[]; error?: { code?: number } };
    if (!metaResponse.ok) throw new AuthError(`Meta request failed (${metaBody.error?.code ?? metaResponse.status})`, 502);

    const { data: settings, error: settingsError } = await client
      .from("settings")
      .select("auto_call_on_lead,retry_config_json")
      .eq("tenant_id", caller.tenantId)
      .maybeSingle();
    if (settingsError) throw settingsError;
    const retryConfig = (settings?.retry_config_json ?? {}) as Record<string, unknown>;
    const maxAttempts = Math.min(20, Math.max(1, Number(retryConfig.max_attempts ?? 5)));

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const lead of metaBody.data ?? []) {
      try {
        if (typeof lead.id !== "string" || !/^\d{5,40}$/.test(lead.id)) {
          failed += 1;
          continue;
        }
        const { data: alreadyImported, error: existingError } = await client
          .from("facebook_lead_imports")
          .select("id")
          .eq("tenant_id", caller.tenantId)
          .eq("leadgen_id", lead.id)
          .maybeSingle();
        if (existingError) throw existingError;
        if (alreadyImported) {
          skipped += 1;
          continue;
        }

        const fields = fieldMap(lead);
        const email = firstMatching(fields, [/email/]).toLowerCase().slice(0, 320) || null;
        const phone = normalizePhone(firstMatching(fields, [/phone/, /tel/])) ;
        const name = firstMatching(fields, [/full_name/, /name/, /nome/]).slice(0, 200) || `Contatto Meta ${lead.id.slice(-6)}`;

        let contactId: string | null = null;
        if (email) {
          const { data, error } = await client.from("contacts").select("id").eq("tenant_id", caller.tenantId).eq("email", email).maybeSingle();
          if (error) throw error;
          contactId = data?.id ?? null;
        }
        if (!contactId && phone) {
          const { data, error } = await client.from("contacts").select("id").eq("tenant_id", caller.tenantId).eq("phone_e164", phone).maybeSingle();
          if (error) throw error;
          contactId = data?.id ?? null;
        }

        const now = new Date().toISOString();
        if (contactId) {
          const { error } = await client.from("contacts").update({ last_activity_at: now, updated_at: now }).eq("tenant_id", caller.tenantId).eq("id", contactId);
          if (error) throw error;
        } else {
          const { data, error } = await client.from("contacts").insert({
            tenant_id: caller.tenantId,
            name,
            email,
            phone_e164: phone,
            last_activity_at: now,
            stage: "FB_INBOX",
          }).select("id").maybeSingle();
          if (error) throw error;
          if (!data) throw new Error("Contact insertion failed");
          contactId = data.id;
          const { error: sourceError } = await client.from("contact_sources").insert({ tenant_id: caller.tenantId, contact_id: contactId, source: "facebook_leadads" });
          if (sourceError && sourceError.code !== "23505") throw sourceError;
        }

        const answersResult = await client.from("lead_form_answers").insert({
          tenant_id: caller.tenantId,
          contact_id: contactId,
          form_provider: "facebook",
          form_id: integration.form_id,
          answers_json: fields,
        });
        if (answersResult.error) throw answersResult.error;

        const importResult = await client.from("facebook_lead_imports").insert({
          tenant_id: caller.tenantId,
          contact_id: contactId,
          leadgen_id: lead.id,
          form_id: integration.form_id,
          page_id: integration.page_id,
          raw_data: { created_time: lead.created_time ?? null, fields },
        });
        if (importResult.error) throw importResult.error;

        if (settings?.auto_call_on_lead === true && phone) {
          const { data: queued, error: queueCheckError } = await client.from("call_queue").select("id").eq("tenant_id", caller.tenantId).eq("contact_id", contactId).in("status", ["pending", "processing"]).limit(1).maybeSingle();
          if (queueCheckError) throw queueCheckError;
          if (!queued) {
            const { error: queueError } = await client.from("call_queue").insert({ tenant_id: caller.tenantId, contact_id: contactId, status: "pending", max_attempts: maxAttempts, next_action_channel: "voice" });
            if (queueError) throw queueError;
          }
        }
        imported += 1;
      } catch {
        failed += 1;
        console.error("Meta lead import failed for one record");
      }
    }

    const { error: auditError } = await client.from("audit_log").insert({
      tenant_id: caller.tenantId,
      actor_user_id: caller.userId,
      action: "meta_leadads.manual_pull_completed",
      payload_json: { imported, skipped, failed },
    });
    if (auditError) console.error("Unable to write Meta lead import audit event");
    return jsonResponse({ success: failed === 0, imported, skipped, failed }, failed === 0 ? 200 : 207, headers);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error("meta-leadads-pull failed");
    return jsonResponse({ error: status < 500 && error instanceof Error ? error.message : "Unable to import Meta leads" }, status, headers);
  }
});
