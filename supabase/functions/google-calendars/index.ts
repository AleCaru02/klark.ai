import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireUserTenant,
} from "../_shared/security.ts";

interface GoogleTokenRow {
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
}

interface GoogleCalendarListItem {
  id?: string;
  summary?: string;
  primary?: boolean;
}

function corsHeaders(request: Request): Record<string, string> {
  const appUrl = requiredEnv("APP_URL").replace(/\/$/, "");
  const extraOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const allowedOrigins = new Set([appUrl, ...extraOrigins]);
  const requestOrigin = request.headers.get("Origin")?.replace(/\/$/, "");
  const allowedOrigin = requestOrigin && allowedOrigins.has(requestOrigin)
    ? requestOrigin
    : appUrl;

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

async function getValidAccessToken(
  tenantId: string,
  token: GoogleTokenRow,
): Promise<string> {
  const expiresAt = token.token_expires_at
    ? new Date(token.token_expires_at).getTime()
    : 0;
  if (token.access_token && expiresAt > Date.now() + 5 * 60 * 1000) {
    return token.access_token;
  }
  if (!token.refresh_token) {
    throw new AuthError("Google Calendar reconnection required", 409);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const body = await response.json().catch(() => ({})) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!response.ok || !body.access_token) {
    const serviceClient = createServiceClient();
    await serviceClient.from("audit_log").insert({
      tenant_id: tenantId,
      action: "google_oauth.refresh_failed",
      payload_json: {
        provider_status: response.status,
        provider_error_code: body.error?.slice(0, 100) ?? "unknown",
      },
    });
    throw new AuthError("Google Calendar reconnection required", 409);
  }

  const serviceClient = createServiceClient();
  const { error: updateError } = await serviceClient
    .from("google_tokens")
    .update({
      access_token: body.access_token,
      token_expires_at: new Date(
        Date.now() + Math.max(60, Number(body.expires_in ?? 3600)) * 1000,
      ).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
  if (updateError) throw updateError;

  return body.access_token;
}

serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, {
      ...headers,
      "Allow": "GET, POST",
    });
  }

  try {
    const serviceClient = createServiceClient();
    const caller = await requireUserTenant(request, serviceClient);

    const { data: tokenData, error: tokenError } = await serviceClient
      .from("google_tokens")
      .select("access_token,refresh_token,token_expires_at")
      .eq("tenant_id", caller.tenantId)
      .maybeSingle();
    if (tokenError) throw tokenError;
    if (!tokenData) {
      return jsonResponse({ connected: false, calendars: [] }, 200, headers);
    }

    const accessToken = await getValidAccessToken(
      caller.tenantId,
      tokenData as GoogleTokenRow,
    );
    const googleResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const googleBody = await googleResponse.json().catch(() => ({})) as {
      items?: GoogleCalendarListItem[];
    };

    if (!googleResponse.ok) {
      await serviceClient.from("audit_log").insert({
        tenant_id: caller.tenantId,
        actor_user_id: caller.userId,
        action: "google_calendar.list_failed",
        payload_json: { provider_status: googleResponse.status },
      });
      return jsonResponse(
        { connected: true, calendars: [], error: "Unable to load calendars" },
        502,
        headers,
      );
    }

    const calendars = (googleBody.items ?? [])
      .filter((calendar) => typeof calendar.id === "string")
      .map((calendar) => ({
        id: calendar.id as string,
        summary: calendar.summary?.slice(0, 200) || "Calendario senza nome",
        primary: calendar.primary === true,
      }));

    return jsonResponse({ connected: true, calendars }, 200, headers);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error("google-calendars failed");
    return jsonResponse(
      {
        error: status < 500 && error instanceof Error
          ? error.message
          : "Unable to load calendars",
      },
      status,
      headers,
    );
  }
});
