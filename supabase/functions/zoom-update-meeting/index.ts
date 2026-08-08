import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Zoom Update Meeting - Updates a Zoom meeting (reschedule)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { meeting_id, start_time, duration_minutes, timezone = "Europe/Rome", topic } = await req.json();

    if (!meeting_id || !start_time) {
      return new Response(
        JSON.stringify({ error: "meeting_id and start_time required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ZOOM_ACCOUNT_ID = Deno.env.get("ZOOM_ACCOUNT_ID");
    const ZOOM_CLIENT_ID = Deno.env.get("ZOOM_CLIENT_ID");
    const ZOOM_CLIENT_SECRET = Deno.env.get("ZOOM_CLIENT_SECRET");

    if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "Zoom not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenResponse = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "account_credentials",
        account_id: ZOOM_ACCOUNT_ID,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with Zoom" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updatePayload: Record<string, unknown> = {
      start_time,
      timezone,
    };
    if (duration_minutes) updatePayload.duration = duration_minutes;
    if (topic) updatePayload.topic = topic;

    const updateResponse = await fetch(`https://api.zoom.us/v2/meetings/${meeting_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    if (updateResponse.ok || updateResponse.status === 204) {
      console.log(`[zoom-update-meeting] Meeting ${meeting_id} updated`);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const errorData = await updateResponse.text();
    console.error(`[zoom-update-meeting] Failed:`, errorData);
    return new Response(
      JSON.stringify({ error: "Failed to update Zoom meeting" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[zoom-update-meeting] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
