import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireUserTenant,
  sha256Hex,
} from "../_shared/security.ts";
import { randomBase64Url } from "../_shared/meta-oauth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, {
      ...corsHeaders,
      Allow: "GET, POST",
    });
  }

  try {
    const supabase = createServiceClient();
    const caller = await requireUserTenant(request, supabase);
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const redirectUri = `${supabaseUrl}/functions/v1/meta-leadads-auth-callback`;
    const state = randomBase64Url();

    const { error: stateError } = await supabase.from("oauth_states").insert({
      state_hash: await sha256Hex(state),
      provider: "facebook",
      tenant_id: caller.tenantId,
      user_id: caller.userId,
      redirect_uri: redirectUri,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      metadata_json: { integration: "lead_ads" },
    });
    if (stateError) throw stateError;

    const scopes = [
      "pages_show_list",
      "pages_read_engagement",
      "leads_retrieval",
      "pages_manage_ads",
    ];
    const authUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
    authUrl.searchParams.set("client_id", requiredEnv("FACEBOOK_APP_ID"));
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(","));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");

    const { error: auditError } = await supabase.from("audit_log").insert({
      tenant_id: caller.tenantId,
      actor_user_id: caller.userId,
      action: "meta_leadads.oauth_started",
      payload_json: { scopes, redirect_uri: redirectUri },
    });
    if (auditError) console.error("[meta-leadads-auth-start] Audit failed", auditError);

    return jsonResponse({ auth_url: authUrl.toString() }, 200, corsHeaders);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    console.error("[meta-leadads-auth-start] Error", error);
    return jsonResponse(
      { error: status < 500 && error instanceof Error ? error.message : "OAuth initialization failed" },
      status,
      corsHeaders,
    );
  }
});
