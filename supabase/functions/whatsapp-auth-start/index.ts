import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireUserTenant,
  sha256Hex,
} from "../_shared/security.ts";
import { randomBase64Url } from "../_shared/meta-oauth.ts";

function corsHeaders(request: Request): Record<string, string> {
  const appUrl = requiredEnv("APP_URL").replace(/\/$/, "");
  const extraOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const allowedOrigins = new Set([appUrl, ...extraOrigins]);
  const requestOrigin = request.headers.get("Origin")?.replace(/\/$/, "");

  return {
    "Access-Control-Allow-Origin": requestOrigin && allowedOrigins.has(requestOrigin)
      ? requestOrigin
      : appUrl,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function graphVersion(): string {
  const value = requiredEnv("META_GRAPH_API_VERSION");
  if (!/^v\d+\.\d+$/.test(value)) throw new Error("Invalid META_GRAPH_API_VERSION");
  return value;
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, {
      ...headers,
      "Allow": "POST",
    });
  }

  try {
    const serviceClient = createServiceClient();
    const caller = await requireUserTenant(request, serviceClient);
    const redirectUri = `${requiredEnv("SUPABASE_URL")}/functions/v1/whatsapp-auth-callback`;
    const state = randomBase64Url();
    const scopes = [
      "whatsapp_business_management",
      "whatsapp_business_messaging",
      "business_management",
    ];

    const { error: stateError } = await serviceClient.from("oauth_states").insert({
      state_hash: await sha256Hex(state),
      provider: "whatsapp",
      tenant_id: caller.tenantId,
      user_id: caller.userId,
      redirect_uri: redirectUri,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      metadata_json: { integration: "whatsapp_business" },
    });
    if (stateError) throw stateError;

    const authUrl = new URL(`https://www.facebook.com/${graphVersion()}/dialog/oauth`);
    authUrl.searchParams.set("client_id", requiredEnv("FACEBOOK_APP_ID"));
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(","));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");

    const { error: auditError } = await serviceClient.from("audit_log").insert({
      tenant_id: caller.tenantId,
      actor_user_id: caller.userId,
      action: "whatsapp.oauth_started",
      payload_json: { scopes },
    });
    if (auditError) console.error("Unable to write WhatsApp OAuth audit event");

    return jsonResponse({ auth_url: authUrl.toString() }, 200, headers);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error("whatsapp-auth-start failed");
    return jsonResponse(
      {
        error: status < 500 && error instanceof Error
          ? error.message
          : "Unable to start WhatsApp authorization",
      },
      status,
      headers,
    );
  }
});
