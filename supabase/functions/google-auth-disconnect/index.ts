import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

async function revokeGoogleToken(token: string | null): Promise<boolean> {
  if (!token) return true;
  try {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

serve(async (request) => {
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

    const { data: tokenData, error: tokenError } = await serviceClient
      .from("google_tokens")
      .select("access_token,refresh_token")
      .eq("tenant_id", caller.tenantId)
      .maybeSingle();
    if (tokenError) throw tokenError;

    const refreshRevoked = await revokeGoogleToken(tokenData?.refresh_token ?? null);
    const accessRevoked = refreshRevoked
      ? true
      : await revokeGoogleToken(tokenData?.access_token ?? null);

    const { error: deleteError } = await serviceClient
      .from("google_tokens")
      .delete()
      .eq("tenant_id", caller.tenantId);
    if (deleteError) throw deleteError;

    const { error: settingsError } = await serviceClient
      .from("settings")
      .update({ calendar_id: null, calendar_enabled: false })
      .eq("tenant_id", caller.tenantId);
    if (settingsError) throw settingsError;

    const { error: auditError } = await serviceClient.from("audit_log").insert({
      tenant_id: caller.tenantId,
      actor_user_id: caller.userId,
      action: "google_oauth.disconnected",
      payload_json: {
        provider_revocation_confirmed: refreshRevoked || accessRevoked,
      },
    });
    if (auditError) console.error("Unable to write Google disconnect audit event");

    return jsonResponse(
      {
        success: true,
        provider_revocation_confirmed: refreshRevoked || accessRevoked,
      },
      200,
      headers,
    );
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error("google-auth-disconnect failed");
    return jsonResponse(
      {
        error: status < 500 && error instanceof Error
          ? error.message
          : "Unable to disconnect Google Calendar",
      },
      status,
      headers,
    );
  }
});
