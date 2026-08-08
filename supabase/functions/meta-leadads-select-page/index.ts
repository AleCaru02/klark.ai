import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireUserTenant,
} from "../_shared/security.ts";

interface MetaPage { id?: string; name?: string; access_token?: string }

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

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, { ...headers, Allow: "POST" });

  try {
    const client = createServiceClient();
    const caller = await requireUserTenant(request, client);
    const payload = await request.json().catch(() => ({})) as { page_id?: unknown };
    if (typeof payload.page_id !== "string" || !/^\d{5,30}$/.test(payload.page_id)) {
      throw new AuthError("Invalid page ID", 400);
    }

    const { data: integration, error: integrationError } = await client
      .from("facebook_integrations")
      .select("access_token,user_access_token")
      .eq("tenant_id", caller.tenantId)
      .maybeSingle();
    if (integrationError) throw integrationError;
    const userToken = integration?.user_access_token || integration?.access_token;
    if (!userToken) throw new AuthError("Meta Lead Ads is not connected", 409);

    const url = new URL(`https://graph.facebook.com/${graphVersion()}/me/accounts`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("fields", "id,name,access_token");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${userToken}` } });
    const body = await response.json().catch(() => ({})) as { data?: MetaPage[]; error?: { code?: number } };
    if (!response.ok) throw new AuthError(`Meta request failed (${body.error?.code ?? response.status})`, 502);
    const page = (body.data ?? []).find((item) => item.id === payload.page_id);
    if (!page?.access_token) throw new AuthError("Page not accessible", 404);

    const { data: updated, error: updateError } = await client
      .from("facebook_integrations")
      .update({ page_id: payload.page_id, access_token: page.access_token, updated_at: new Date().toISOString() })
      .eq("tenant_id", caller.tenantId)
      .select("page_id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) throw new Error("Meta integration update failed");

    const { error: auditError } = await client.from("audit_log").insert({
      tenant_id: caller.tenantId,
      actor_user_id: caller.userId,
      action: "meta_leadads.page_selected",
      payload_json: { page_id: payload.page_id, page_name: page.name?.slice(0, 200) ?? null },
    });
    if (auditError) console.error("Unable to write Meta page selection audit event");

    return jsonResponse({ success: true, page_id: payload.page_id, page_name: page.name?.slice(0, 200) ?? null }, 200, headers);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error("meta-leadads-select-page failed");
    return jsonResponse({ error: status < 500 && error instanceof Error ? error.message : "Unable to select Meta page" }, status, headers);
  }
});
