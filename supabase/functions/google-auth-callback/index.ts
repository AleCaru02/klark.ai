import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createServiceClient,
  requiredEnv,
  sha256Hex,
} from "../_shared/security.ts";

serve(async (request) => {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const callbackUrl = new URL(request.url);
  const appUrl = requiredEnv("APP_URL").replace(/\/$/, "");
  const destination = `${appUrl}/app/integrations/google-calendar`;
  const supabase = createServiceClient();

  try {
    const providerError = callbackUrl.searchParams.get("error");
    if (providerError) {
      return redirect(destination, { error: "oauth_denied" });
    }

    const code = callbackUrl.searchParams.get("code");
    const state = callbackUrl.searchParams.get("state");
    if (!code || !state) return redirect(destination, { error: "invalid_callback" });

    const { data: states, error: stateError } = await supabase.rpc(
      "consume_oauth_state",
      { p_provider: "google", p_state_hash: await sha256Hex(state) },
    );
    if (stateError) throw stateError;
    const oauthState = states?.[0];
    if (!oauthState?.tenant_id || !oauthState?.user_id || !oauthState?.redirect_uri) {
      return redirect(destination, { error: "invalid_or_expired_state" });
    }

    const tenantId = oauthState.tenant_id as string;
    const userId = oauthState.user_id as string;
    const redirectUri = oauthState.redirect_uri as string;
    if (!allowedGoogleRedirectUris().has(redirectUri)) {
      return redirect(destination, { error: "redirect_mismatch" });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return redirect(destination, { error: "access_denied" });

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: requiredEnv("GOOGLE_CLIENT_ID"),
        client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenResponse.json() as Record<string, unknown>;
    if (!tokenResponse.ok || typeof tokenData.access_token !== "string") {
      await writeAudit(supabase, tenantId, userId, "google_oauth.token_exchange_failed", {
        provider_error: tokenData.error,
      });
      return redirect(destination, { error: "token_exchange_failed" });
    }

    const grantedScope = typeof tokenData.scope === "string" ? tokenData.scope : "";
    if (!hasRequiredCalendarScopes(grantedScope)) {
      await writeAudit(supabase, tenantId, userId, "google_oauth.insufficient_scope", {
        granted_scope: grantedScope,
      });
      return redirect(destination, { error: "insufficient_scope" });
    }

    const { data: existingToken, error: existingTokenError } = await supabase
      .from("google_tokens")
      .select("refresh_token")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (existingTokenError) throw existingTokenError;
    const refreshToken = typeof tokenData.refresh_token === "string" && tokenData.refresh_token
      ? tokenData.refresh_token
      : existingToken?.refresh_token;
    if (!refreshToken) {
      await writeAudit(supabase, tenantId, userId, "google_oauth.refresh_token_missing", {});
      return redirect(destination, { error: "refresh_token_missing" });
    }

    const tokenRecord: Record<string, unknown> = {
      tenant_id: tenantId,
      access_token: tokenData.access_token,
      refresh_token: refreshToken,
      token_expires_at: new Date(
        Date.now() + Math.max(60, Number(tokenData.expires_in || 3600)) * 1000,
      ).toISOString(),
      scope: grantedScope,
      updated_at: new Date().toISOString(),
    };

    const { error: tokenError } = await supabase
      .from("google_tokens")
      .upsert(tokenRecord, { onConflict: "tenant_id" });
    if (tokenError) throw tokenError;

    await writeAudit(supabase, tenantId, userId, "google_oauth.connected", {
      scope: tokenRecord.scope,
      refresh_token_received: Boolean(tokenData.refresh_token),
      refresh_token_preserved: !tokenData.refresh_token && Boolean(refreshToken),
    });

    const { error: syncError } = await supabase.functions.invoke(
      "google-calendar-sync",
      { body: { tenant_id: tenantId, user_id: userId } },
    );
    if (syncError) console.error("[google-auth-callback] Initial sync failed", syncError);

    await registerGoogleWatch(
      supabase,
      tenantId,
      tokenData.access_token as string,
    );

    return redirect(destination, { success: "true" });
  } catch (error) {
    console.error("[google-auth-callback] Error", error);
    return redirect(destination, { error: "oauth_callback_failed" });
  }
});

function allowedGoogleRedirectUris(): Set<string> {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const legacyRedirectUri = `${supabaseUrl}/functions/v1/google-auth-callback`;
  const configured = (Deno.env.get("GOOGLE_REDIRECT_URI") ?? "").trim();
  const allowed = new Set<string>([legacyRedirectUri]);
  if (configured) {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:" || parsed.pathname !== "/functions/v1/google-auth-callback") {
      throw new Error("Invalid GOOGLE_REDIRECT_URI");
    }
    allowed.add(parsed.toString());
  }
  return allowed;
}

async function registerGoogleWatch(
  supabase: any,
  tenantId: string,
  accessToken: string,
) {
  const channelId = crypto.randomUUID();
  const channelToken = randomBase64Url(32);
  const expiresAt = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
  const webhookAddress = `${requiredEnv("SUPABASE_URL")}/functions/v1/calendar-watch`;

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events/watch",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: webhookAddress,
        token: channelToken,
        expiration: expiresAt.getTime().toString(),
      }),
    },
  );

  if (!response.ok) {
    console.error("[google-auth-callback] Watch registration failed", response.status);
    return;
  }

  const watch = await response.json() as {
    resourceId?: string;
    expiration?: string;
  };
  const providerExpiry = Number(watch.expiration);
  const { error } = await supabase.from("google_watch_channels").upsert({
    tenant_id: tenantId,
    channel_id: channelId,
    resource_id: watch.resourceId || null,
    calendar_id: "primary",
    token_hash: await sha256Hex(channelToken),
    expires_at: Number.isFinite(providerExpiry)
      ? new Date(providerExpiry).toISOString()
      : expiresAt.toISOString(),
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "channel_id" });
  if (error) throw error;
}

function hasRequiredCalendarScopes(scopeValue: string): boolean {
  const scopes = new Set(scopeValue.split(/\s+/).filter(Boolean));
  const fullCalendar = scopes.has("https://www.googleapis.com/auth/calendar");
  const canListCalendars = fullCalendar ||
    scopes.has("https://www.googleapis.com/auth/calendar.calendarlist") ||
    scopes.has("https://www.googleapis.com/auth/calendar.calendarlist.readonly");
  const canWriteEvents = fullCalendar ||
    scopes.has("https://www.googleapis.com/auth/calendar.events") ||
    scopes.has("https://www.googleapis.com/auth/calendar.events.owned");
  const canReadFreeBusy = fullCalendar ||
    scopes.has("https://www.googleapis.com/auth/calendar.freebusy") ||
    scopes.has("https://www.googleapis.com/auth/calendar.events.freebusy") ||
    scopes.has("https://www.googleapis.com/auth/calendar.readonly");
  return canListCalendars && canWriteEvents && canReadFreeBusy;
}

async function writeAudit(
  supabase: any,
  tenantId: string,
  userId: string,
  action: string,
  payload: Record<string, unknown>,
) {
  const { error } = await supabase.from("audit_log").insert({
    tenant_id: tenantId,
    actor_user_id: userId,
    action,
    payload_json: payload,
  });
  if (error) console.error("[google-auth-callback] Audit write failed", error);
}

function redirect(base: string, params: Record<string, string>): Response {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url.toString(), 302);
}

function randomBase64Url(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
