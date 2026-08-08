import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateAppointmentRequest {
  tenant_id: string;
  contact_id: string;
  title: string;
  start_at: string;
  duration_minutes: number;
  description?: string;
  timezone?: string;
  location?: string;
  meeting_type?: "online" | "in_person";
  meeting_provider?: "google_meet" | "zoom" | "call" | "other" | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: CreateAppointmentRequest = await req.json();
    const { tenant_id, contact_id, title, start_at, duration_minutes, description } = body;
    const timezone = body.timezone || "Europe/Rome";
    const meetingType = body.meeting_type || "online";
    const meetingProvider = body.meeting_provider || null;

    // Input validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!tenant_id || !uuidRegex.test(tenant_id)) {
      return new Response(JSON.stringify({ error: "Invalid or missing tenant_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!contact_id || !uuidRegex.test(contact_id)) {
      return new Response(JSON.stringify({ error: "Invalid or missing contact_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!title || typeof title !== "string" || title.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid or missing title" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!start_at || isNaN(new Date(start_at).getTime())) {
      return new Response(JSON.stringify({ error: "Invalid or missing start_at" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!duration_minutes || typeof duration_minutes !== "number" || duration_minutes < 15 || duration_minutes > 480) {
      return new Response(JSON.stringify({ error: "Invalid duration_minutes (15-480)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const startDate = new Date(start_at);
    const endDate = new Date(startDate.getTime() + duration_minutes * 60 * 1000);

    // Get contact info
    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("name, phone_e164, email")
      .eq("id", contact_id)
      .single();

    let googleEventId: string | null = null;
    let meetLink: string | null = null;
    let googleCalendarId: string | null = null;
    let zoomLink: string | null = null;
    let zoomMeetingId: string | null = null;

    // ── Google Meet: create GCal event with Meet link ──
    if (meetingProvider === "google_meet") {
      const { data: googleToken } = await supabaseAdmin
        .from("google_tokens")
        .select("access_token, refresh_token, token_expires_at, calendar_id")
        .eq("tenant_id", tenant_id)
        .single();

      if (googleToken) {
        let accessToken = googleToken.access_token;
        const expiresAt = new Date(googleToken.token_expires_at);
        
        if (expiresAt <= new Date()) {
          const refreshed = await refreshGoogleToken(googleToken.refresh_token);
          if (refreshed) {
            accessToken = refreshed.access_token;
            await supabaseAdmin
              .from("google_tokens")
              .update({
                access_token: refreshed.access_token,
                token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
              })
              .eq("tenant_id", tenant_id);
          }
        }

        const calendarId = googleToken.calendar_id || "primary";
        googleCalendarId = calendarId;

        const eventResult = await createGoogleCalendarEvent(
          accessToken,
          calendarId,
          {
            summary: title,
            description: description || `Appuntamento con ${contact?.name || "Cliente"}`,
            start: { dateTime: startDate.toISOString(), timeZone: timezone },
            end: { dateTime: endDate.toISOString(), timeZone: timezone },
            attendees: contact?.email ? [{ email: contact.email }] : [],
            conferenceData: {
              createRequest: {
                requestId: crypto.randomUUID(),
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
          }
        );

        if (eventResult) {
          googleEventId = eventResult.id;
          meetLink = eventResult.hangoutLink || null;
          console.log(`[create-appointment] Created Google event: ${googleEventId}, Meet: ${meetLink}`);
        }
      }
    }

    // ── Zoom: call zoom-create-meeting ──
    if (meetingProvider === "zoom") {
      try {
        const zoomRes = await fetch(`${supabaseUrl}/functions/v1/zoom-create-meeting`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_id,
            topic: title,
            start_time: startDate.toISOString(),
            duration_minutes,
            timezone,
            description: description || `Appuntamento con ${contact?.name || "Cliente"}`,
          }),
        });

        if (zoomRes.ok) {
          const zoomData = await zoomRes.json();
          zoomLink = zoomData.join_url || null;
          zoomMeetingId = zoomData.meeting_id?.toString() || null;
          console.log(`[create-appointment] Created Zoom meeting: ${zoomMeetingId}, Link: ${zoomLink}`);
        } else {
          console.error("[create-appointment] Zoom creation failed:", await zoomRes.text());
        }
      } catch (zoomErr) {
        console.error("[create-appointment] Zoom error:", zoomErr);
      }

      // Also create GCal event without Meet (if Google connected)
      const { data: googleToken } = await supabaseAdmin
        .from("google_tokens")
        .select("access_token, refresh_token, token_expires_at, calendar_id")
        .eq("tenant_id", tenant_id)
        .single();

      if (googleToken) {
        let accessToken = googleToken.access_token;
        const expiresAt = new Date(googleToken.token_expires_at);
        if (expiresAt <= new Date()) {
          const refreshed = await refreshGoogleToken(googleToken.refresh_token);
          if (refreshed) {
            accessToken = refreshed.access_token;
            await supabaseAdmin.from("google_tokens").update({
              access_token: refreshed.access_token,
              token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            }).eq("tenant_id", tenant_id);
          }
        }
        const calendarId = googleToken.calendar_id || "primary";
        googleCalendarId = calendarId;

        const eventResult = await createGoogleCalendarEvent(accessToken, calendarId, {
          summary: title,
          description: `${description || ""}\n\nZoom: ${zoomLink || "N/A"}`.trim(),
          start: { dateTime: startDate.toISOString(), timeZone: timezone },
          end: { dateTime: endDate.toISOString(), timeZone: timezone },
          attendees: contact?.email ? [{ email: contact.email }] : [],
        });

        if (eventResult) {
          googleEventId = eventResult.id;
          console.log(`[create-appointment] Created Google event for Zoom: ${googleEventId}`);
        }
      }
    }

    // ── In-person / Sopralluogo: create GCal event without Meet ──
    if (meetingType === "in_person") {
      const { data: googleToken } = await supabaseAdmin
        .from("google_tokens")
        .select("access_token, refresh_token, token_expires_at, calendar_id")
        .eq("tenant_id", tenant_id)
        .single();

      if (googleToken) {
        let accessToken = googleToken.access_token;
        const expiresAt = new Date(googleToken.token_expires_at);
        if (expiresAt <= new Date()) {
          const refreshed = await refreshGoogleToken(googleToken.refresh_token);
          if (refreshed) {
            accessToken = refreshed.access_token;
            await supabaseAdmin.from("google_tokens").update({
              access_token: refreshed.access_token,
              token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            }).eq("tenant_id", tenant_id);
          }
        }
        const calendarId = googleToken.calendar_id || "primary";
        googleCalendarId = calendarId;

        const eventResult = await createGoogleCalendarEvent(accessToken, calendarId, {
          summary: title,
          description: description || `Sopralluogo con ${contact?.name || "Cliente"}`,
          location: body.location || undefined,
          start: { dateTime: startDate.toISOString(), timeZone: timezone },
          end: { dateTime: endDate.toISOString(), timeZone: timezone },
          attendees: contact?.email ? [{ email: contact.email }] : [],
        });

        if (eventResult) {
          googleEventId = eventResult.id;
          console.log(`[create-appointment] Created Google event for in-person: ${googleEventId}`);
        }
      }
    }

    // Get settings for WhatsApp
    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("whatsapp_enabled, whatsapp_phone_number_id")
      .eq("tenant_id", tenant_id)
      .single();

    const whatsappEnabled = settings?.whatsapp_enabled && settings?.whatsapp_phone_number_id;

    // Determine the final meet_link (Google Meet or Zoom)
    const finalMeetLink = meetLink || zoomLink || null;

    // Create appointment in database
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from("appointments")
      .insert({
        tenant_id,
        contact_id,
        title,
        description,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        timezone,
        status: "scheduled",
        calendar_event_id: googleEventId,
        google_calendar_id: googleCalendarId,
        meet_link: finalMeetLink,
        meeting_type: meetingType,
        meeting_provider: meetingProvider,
        meeting_id: zoomMeetingId,
        location: body.location || null,
        created_from: "crm",
      })
      .select()
      .single();

    if (appointmentError) {
      console.error("[create-appointment] DB error:", appointmentError);
      return new Response(JSON.stringify({ error: "Failed to create appointment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update contact's last_activity_at
    await supabaseAdmin
      .from("contacts")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", contact_id);

    // Format date for WhatsApp messages (Italian)
    const dayNames = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
    const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    const dayName = dayNames[startDate.getDay()];
    const day = startDate.getDate();
    const month = monthNames[startDate.getMonth()];
    const hours = startDate.getHours().toString().padStart(2, "0");
    const minutes = startDate.getMinutes().toString().padStart(2, "0");
    const formattedDate = `${dayName} ${day} ${month}`;
    const formattedTime = `${hours}:${minutes}`;

    // Generate outbound confirmation message
    let confirmationText: string;
    if (meetingType === "in_person") {
      const locationText = body.location || "da definire";
      confirmationText = `Conferma appuntamento ${formattedDate} alle ${formattedTime} presso ${locationText}. Rispondi CONFERMO / SPOSTA / ANNULLA.`;
    } else if (finalMeetLink) {
      confirmationText = `Conferma appuntamento ${formattedDate} alle ${formattedTime}. Link: ${finalMeetLink}. Rispondi CONFERMO / SPOSTA / ANNULLA.`;
    } else {
      confirmationText = `Conferma appuntamento ${formattedDate} alle ${formattedTime}. Rispondi CONFERMO / SPOSTA / ANNULLA.`;
    }

    // Save outbound confirmation message
    const deliveryStatus = whatsappEnabled ? "pending" : "simulated";
    await supabaseAdmin.from("whatsapp_messages").insert({
      tenant_id,
      contact_id,
      appointment_id: appointment.id,
      wa_from: settings?.whatsapp_phone_number_id || "system",
      text: confirmationText,
      direction: "out",
      message_type: "confirm_now",
      delivery_status: deliveryStatus,
      message_id: `confirm_${appointment.id}_${Date.now()}`,
      ts: new Date().toISOString(),
    });

    console.log(`[create-appointment] Created confirmation message (status: ${deliveryStatus})`);

    // Create reminders
    const now = new Date();
    const reminder24hBefore = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);

    const remindersToCreate = [
      {
        tenant_id,
        contact_id,
        appointment_id: appointment.id,
        channel: "whatsapp",
        reminder_type: "confirmation",
        when_ts: now.toISOString(),
        status: "pending",
        payload_json: {
          title,
          start_at: startDate.toISOString(),
          meet_link: finalMeetLink,
          contact_name: contact?.name,
          contact_phone: contact?.phone_e164,
          meeting_type: meetingType,
          meeting_provider: meetingProvider,
          location: body.location,
        },
      },
    ];

    if (reminder24hBefore > now) {
      remindersToCreate.push({
        tenant_id,
        contact_id,
        appointment_id: appointment.id,
        channel: "whatsapp",
        reminder_type: "reminder_24h",
        when_ts: reminder24hBefore.toISOString(),
        status: "pending",
        payload_json: {
          title,
          start_at: startDate.toISOString(),
          meet_link: finalMeetLink,
          contact_name: contact?.name,
          contact_phone: contact?.phone_e164,
          meeting_type: meetingType,
          meeting_provider: meetingProvider,
          location: body.location,
        },
      });
    }

    await supabaseAdmin.from("reminders").insert(remindersToCreate);
    console.log(`[create-appointment] Created ${remindersToCreate.length} reminders`);

    // ── Move contact to appointment_set stage (using stage_type) ──
    const { data: pipelines } = await supabaseAdmin
      .from("pipelines")
      .select("id")
      .eq("tenant_id", tenant_id)
      .limit(1);

    if (pipelines && pipelines.length > 0) {
      const { data: stages } = await supabaseAdmin
        .from("stages")
        .select("id, stage_type")
        .eq("pipeline_id", pipelines[0].id)
        .eq("is_active", true)
        .order("position", { ascending: true });

      if (stages) {
        // Find stage by stage_type = 'appointment_set'
        const appointmentStage = stages.find(s => s.stage_type === "appointment_set");
        
        if (appointmentStage) {
          const { data: existingStage } = await supabaseAdmin
            .from("contact_stages")
            .select("id")
            .eq("contact_id", contact_id)
            .single();

          if (existingStage) {
            await supabaseAdmin
              .from("contact_stages")
              .update({ stage_id: appointmentStage.id, updated_at: new Date().toISOString() })
              .eq("contact_id", contact_id);
          } else {
            await supabaseAdmin
              .from("contact_stages")
              .insert({ tenant_id, contact_id, stage_id: appointmentStage.id });
          }

          console.log(`[create-appointment] Moved contact to appointment_set stage: ${appointmentStage.id}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        appointment: {
          id: appointment.id,
          title: appointment.title,
          start_at: appointment.start_at,
          end_at: appointment.end_at,
          meet_link: finalMeetLink,
          zoom_link: zoomLink,
          google_event_id: googleEventId,
          meeting_type: meetingType,
          meeting_provider: meetingProvider,
        },
        google_connected: !!googleCalendarId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[create-appointment] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: any
): Promise<{ id: string; hangoutLink?: string } | null> {
  try {
    const hasConference = !!event.conferenceData;
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${hasConference ? "?conferenceDataVersion=1" : ""}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...event,
        extendedProperties: {
          private: { app_managed: "true" },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[create-appointment] Google API error:", error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("[create-appointment] Error creating Google event:", error);
    return null;
  }
}
