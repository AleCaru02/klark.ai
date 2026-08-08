import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireUserTenant,
  sha256Hex,
} from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { ...corsHeaders, Allow: "GET, POST" });
  }

  try {
    const supabase = createServiceClient();
    const context = await requireUserTenant(request, supabase);
    const requestUrl = new URL(request.url);
    const requestedTenantId = requestUrl.searchParams.get("tenant_id");
    if (requestedTenantId && requestedTenantId !== context.tenantId) {
      throw new AuthError("Cross-tenant OAuth request denied", 403);
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const clientId = requiredEnv("GOOGLE_CLIENT_ID");
    const redirectUri = `${supabaseUrl}/functions/v1/google-auth-callback`;
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
    ];
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    const { error: auditError } = await supabase.from("audit_log").insert({
      tenant_id: context.tenantId,
      actor_user_id: context.userId,
      action: "google_oauth.start",
      payload_json: { redirect_uri: redirectUri, scopes },
    });
    if (auditError) console.error("[google-auth-start] Audit write failed", auditError);

    return jsonResponse({ auth_url: authUrl.toString() }, 200, corsHeaders);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    console.error("[google-auth-start] Error", error);
    return jsonResponse(
      { error: status < 500 && error instanceof Error ? error.message : "OAuth initialization failed" },
      status,
      corsHeaders,
    );
  }
});

function randomBase64Url(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
