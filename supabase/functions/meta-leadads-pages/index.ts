import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireUserTenant,
} from "../_shared/security.ts";

interface MetaPage { id?: string; name?: string; category?: string; access_token?: string }
interface MetaForm { id?: string; name?: string; status?: string; leads_count?: number; created_time?: string }

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

async function metaGet(path: string, token: string, parameters: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${graphVersion()}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({})) as { data?: unknown[]; error?: { code?: number } };
  if (!response.ok) throw new AuthError(`Meta request failed (${body.error?.code ?? response.status})`, 502);
  return body.data ?? [];
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, { ...headers, Allow: "POST" });

  try {
    const client = createServiceClient();
    const caller = await requireUserTenant(request, client);
    const payload = await request.json().catch(() => ({})) as { page_id?: unknown };
    const pageId = typeof payload.page_id === "string" && /^\d{5,30}$/.test(payload.page_id) ? payload.page_id : null;

    const { data: integration, error } = await client
      .from("facebook_integrations")
      .select("access_token,user_access_token")
      .eq("tenant_id", caller.tenantId)
      .maybeSingle();
    if (error) throw error;
    const userToken = integration?.user_access_token || integration?.access_token;
    if (!userToken) return jsonResponse({ connected: false, pages: [], forms: [] }, 200, headers);

    const rawPages = await metaGet("me/accounts", userToken, {
      limit: "100",
      fields: "id,name,category,access_token",
    }) as MetaPage[];
    const pages = rawPages
      .filter((page) => typeof page.id === "string")
      .map((page) => ({ id: page.id as string, name: page.name?.slice(0, 200) || "Pagina senza nome", category: page.category?.slice(0, 100) || null }));

    if (!pageId) return jsonResponse({ connected: true, pages }, 200, headers);
    const page = rawPages.find((item) => item.id === pageId);
    if (!page?.access_token) throw new AuthError("Page not accessible", 404);
    const rawForms = await metaGet(`${pageId}/leadgen_forms`, page.access_token, {
      limit: "100",
      fields: "id,name,status,leads_count,created_time",
    }) as MetaForm[];
    const forms = rawForms
      .filter((form) => typeof form.id === "string")
      .map((form) => ({
        id: form.id as string,
        name: form.name?.slice(0, 200) || "Modulo senza nome",
        status: form.status?.slice(0, 50) || null,
        leads_count: Math.max(0, Number(form.leads_count ?? 0)),
        created_time: form.created_time ?? null,
      }));
    return jsonResponse({ connected: true, pages, forms }, 200, headers);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error("meta-leadads-pages failed");
    return jsonResponse({ error: status < 500 && error instanceof Error ? error.message : "Unable to load Meta pages" }, status, headers);
  }
});
