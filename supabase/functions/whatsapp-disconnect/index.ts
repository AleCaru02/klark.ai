import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireUserTenant,
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
    "Access-Control-Allow-Origin": requestOrigin && allowed.has(requestOrigin)
      ? requestOrigin
      : appUrl,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
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

    const { data: integration, error: integrationError } = await serviceClient
      .from("whatsapp_integrations")
      .select("id")
      .eq("tenant_id", caller.tenantId)
      .maybeSingle();
    if (integrationError) throw integrationError;

    if (integration) {
      const { error: deleteError } = await serviceClient
        .from("whatsapp_integrations")
        .delete()
        .eq("tenant_id", caller.tenantId);
      if (deleteError) throw deleteError;
    }

    const { error: settingsError } = await serviceClient
      .from("settings")
      .update({
        whatsapp_enabled: false,
        whatsapp_phone_number_id: null,
        whatsapp_display_number: null,
      })
      .eq("tenant_id", caller.tenantId);
    if (settingsError) throw settingsError;

    const { error: auditError } = await serviceClient.from("audit_log").insert({
      tenant_id: caller.tenantId,
      actor_user_id: caller.userId,
      action: "whatsapp.disconnected",
      payload_json: { integration_existed: Boolean(integration) },
    });
    if (auditError) console.error("Unable to write WhatsApp disconnect audit event");

    return jsonResponse(
      {
        success: true,
        provider_token_revocation_required: Boolean(integration),
      },
      200,
      headers,
    );
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error("whatsapp-disconnect failed");
    return jsonResponse(
      {
        error: status < 500 && error instanceof Error
          ? error.message
          : "Unable to disconnect WhatsApp",
      },
      status,
      headers,
    );
  }
});
