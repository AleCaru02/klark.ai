import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user claims
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseUser.auth.getClaims(token);

    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;

    // Get user's tenant
    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = membership.tenant_id;

    // Get Google tokens
    const { data: tokens, error: tokensError } = await supabaseAdmin
      .from("google_tokens")
      .select("access_token, refresh_token, token_expires_at")
      .eq("tenant_id", tenantId)
      .single();

    if (tokensError || !tokens) {
      return new Response(JSON.stringify({ error: "Google Calendar not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if token needs refresh
    let accessToken = tokens.access_token;
    const tokenExpiry = new Date(tokens.token_expires_at);
    
    if (tokenExpiry <= new Date()) {
      console.log("Token expired, refreshing...");
      accessToken = await refreshAccessToken(supabaseAdmin, tenantId, tokens.refresh_token);
    }

    // Get calendar ID from settings
    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("calendar_id")
      .eq("tenant_id", tenantId)
      .single();

    const calendarId = settings?.calendar_id || "primary";

    // Build the webhook URL
    const webhookUrl = `${SUPABASE_URL}/functions/v1/calendar-watch`;

    // Generate a unique channel ID
    const channelId = crypto.randomUUID();

    // Calculate expiration (max 7 days for Google Calendar API)
    const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000;

    // Register the watch
    const watchResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: webhookUrl,
          token: tenantId, // Use tenant_id as token for identification
          expiration: expiration.toString(),
        }),
      }
    );

    if (!watchResponse.ok) {
      const errorText = await watchResponse.text();
      console.error("Failed to register watch:", errorText);
      
      // Parse error for user-friendly message
      let errorMessage = "Failed to register calendar watch";
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Use default message
      }

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const watchData = await watchResponse.json();

    console.log("Watch registered successfully:", watchData);

    // Log to audit
    await supabaseAdmin.from("audit_log").insert({
      tenant_id: tenantId,
      actor_user_id: userId,
      action: "calendar.watch_registered",
      payload_json: {
        channel_id: channelId,
        calendar_id: calendarId,
        expiration: new Date(expiration).toISOString(),
        resource_id: watchData.resourceId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: channelId,
        resource_id: watchData.resourceId,
        expiration: new Date(expiration).toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Watch registration error:", error);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// deno-lint-ignore no-explicit-any
async function refreshAccessToken(
  supabase: any,
  tenantId: string,
  refreshToken: string
): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to refresh access token");
  }

  const tokenData = await tokenResponse.json();
  const newAccessToken = tokenData.access_token;
  const expiresIn = tokenData.expires_in || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  await supabase
    .from("google_tokens")
    .update({
      access_token: newAccessToken,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq("tenant_id", tenantId);

  return newAccessToken;
}
