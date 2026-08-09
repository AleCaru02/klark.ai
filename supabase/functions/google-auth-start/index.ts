import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireUserTenant,
  sha256Hex,
} from "../_shared/security.ts";

function corsHeaders(request: Request): Record<string, string> {
  const appUrl = requiredEnv("APP_URL").replace(/\/$/, "");
  const extraOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const allowed = new Set([appUrl, ...extraOrigins]);
  const requestOrigin = request.headers.get("Origin")?.replace(/\/$/, "");
  return {
    "Access-Control-Allow-Origin": requestOrigin && allowed.has(requestOrigin) ? requestOrigin : appUrl,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { ...headers, Allow: "GET, POST" });
  }

  try {
    const supabase = createServiceClient();
    const context = await requireUserTenant(request, supabase);
    const requestUrl = new URL(request.url);
    const requestedTenantId = requestUrl.searchParams.get("tenant_id");
    if (requestedTenantId && requestedTenantId !== context.tenantId) {
      throw new AuthError("Cross-tenant OAuth request denied", 403);
    }

    const clientId = requiredEnv("GOOGLE_CLIENT_ID");
    const redirectUri = resolveGoogleRedirectUri();
    const state = randomBase64Url(32);
    const stateHash = await sha256Hex(state);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: stateError } = await supabase.from("oauth_states").insert({
      state_hash: stateHash,
      provider: "google",
      tenant_id: context.tenantId,
      user_id: context.userId,
      redirect_uri: redirectUri,
      metadata_json: {},
      expires_at: expiresAt,
    });
    if (stateError) throw stateError;

    const scopes = [
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.events.freebusy",
    ];
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    const { error: auditError } = await supabase.from("audit_log").insert({
      tenant_id: context.tenantId,
      actor_user_id: context.userId,
      action: "google_oauth.start",
      payload_json: { redirect_uri: redirectUri, scopes },
    });
    if (auditError) console.error("[google-auth-start] Audit write failed", auditError);

    return jsonResponse({ auth_url: authUrl.toString() }, 200, headers);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    console.error("[google-auth-start] Error", error);
    return jsonResponse(
      { error: status < 500 && error instanceof Error ? error.message : "OAuth initialization failed" },
      status,
      headers,
    );
  }
});

function resolveGoogleRedirectUri(): string {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const legacyRedirectUri = `${supabaseUrl}/functions/v1/google-auth-callback`;
  const configured = (Deno.env.get("GOOGLE_REDIRECT_URI") ?? "").trim();
  if (!configured) return legacyRedirectUri;

  const parsed = new URL(configured);
  if (parsed.protocol !== "https:" || parsed.pathname !== "/functions/v1/google-auth-callback") {
    throw new Error("Invalid GOOGLE_REDIRECT_URI");
  }
  return parsed.toString();
}

function randomBase64Url(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
