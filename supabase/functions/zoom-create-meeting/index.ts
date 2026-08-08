import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Zoom Create Meeting - Creates a Zoom meeting for an appointment
 * Called by ai-book-appointment when meeting_provider = zoom
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ZoomMeetingRequest {
  tenant_id: string;
  topic: string;
  start_time: string; // ISO 8601
  duration_minutes: number;
  timezone?: string;
  description?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: ZoomMeetingRequest = await req.json();
    const { tenant_id, topic, start_time, duration_minutes, timezone = "Europe/Rome", description } = body;

    if (!tenant_id || !topic || !start_time) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant's Zoom credentials from settings
    const { data: settings } = await supabase
      .from("settings")
      .select("zoom_access_token, zoom_refresh_token, zoom_token_expires_at, zoom_user_id")
      .eq("tenant_id", tenant_id)
      .single();

    // Since zoom columns don't exist yet in settings, we'll use a zoom_tokens approach
    // For now, check if ZOOM_API_KEY secret is available (server-to-server OAuth)
    const ZOOM_ACCOUNT_ID = Deno.env.get("ZOOM_ACCOUNT_ID");
    const ZOOM_CLIENT_ID = Deno.env.get("ZOOM_CLIENT_ID");
    const ZOOM_CLIENT_SECRET = Deno.env.get("ZOOM_CLIENT_SECRET");

    if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
      console.log("[zoom-create-meeting] Zoom credentials not configured");
      return new Response(
        JSON.stringify({ error: "Zoom not configured", zoom_configured: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Zoom access token via Server-to-Server OAuth
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
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("[zoom-create-meeting] Failed to get Zoom token:", tokenData);
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with Zoom" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Zoom meeting
    const meetingPayload = {
      topic,
      type: 2, // Scheduled meeting
      start_time,
      duration: duration_minutes,
      timezone,
      agenda: description || "",
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        waiting_room: false,
        auto_recording: "none",
      },
    };

    const meetingResponse = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(meetingPayload),
    });

    const meetingData = await meetingResponse.json();

    if (!meetingResponse.ok) {
      console.error("[zoom-create-meeting] Failed to create meeting:", meetingData);
      return new Response(
        JSON.stringify({ error: "Failed to create Zoom meeting", details: meetingData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[zoom-create-meeting] Created meeting: ${meetingData.id}, link: ${meetingData.join_url}`);

    return new Response(
      JSON.stringify({
        success: true,
        meeting_id: String(meetingData.id),
        join_url: meetingData.join_url,
        start_url: meetingData.start_url,
        password: meetingData.password,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[zoom-create-meeting] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
