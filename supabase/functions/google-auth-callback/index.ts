import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createServiceClient,
  requiredEnv,
  sha256Hex,
} from "../_shared/security.ts";

serve(async (request) => {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const callbackUrl = new URL(request.url);
  const appUrl = Deno.env.get("APP_URL")?.replace(/\/$/, "") ||
    "https://assistant-call-sync.lovable.app";
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
    const expectedRedirectUri = `${requiredEnv("SUPABASE_URL")}/functions/v1/google-auth-callback`;
    if (redirectUri !== expectedRedirectUri) {
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

    const tokenRecord: Record<string, unknown> = {
      tenant_id: tenantId,
      access_token: tokenData.access_token,
      token_expires_at: new Date(
        Date.now() + Number(tokenData.expires_in || 3600) * 1000,
      ).toISOString(),
      scope: typeof tokenData.scope === "string" ? tokenData.scope : "",
      updated_at: new Date().toISOString(),
    };
    if (typeof tokenData.refresh_token === "string" && tokenData.refresh_token) {
      tokenRecord.refresh_token = tokenData.refresh_token;
    }

    const { error: tokenError } = await supabase
      .from("google_tokens")
      .upsert(tokenRecord, { onConflict: "tenant_id" });
    if (tokenError) throw tokenError;

    await writeAudit(supabase, tenantId, userId, "google_oauth.connected", {
      scope: tokenRecord.scope,
      refresh_token_received: Boolean(tokenRecord.refresh_token),
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
