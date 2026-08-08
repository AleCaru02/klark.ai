import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Zoom Delete Meeting - Deletes/cancels a Zoom meeting
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
    const { meeting_id } = await req.json();

    if (!meeting_id) {
      return new Response(
        JSON.stringify({ error: "meeting_id required" }),
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

    // Get token
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

    // Delete meeting
    const deleteResponse = await fetch(`https://api.zoom.us/v2/meetings/${meeting_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const deleted = deleteResponse.ok || deleteResponse.status === 404;
    console.log(`[zoom-delete-meeting] Meeting ${meeting_id}: ${deleted ? "deleted" : "failed"}`);

    return new Response(
      JSON.stringify({ success: deleted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[zoom-delete-meeting] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
