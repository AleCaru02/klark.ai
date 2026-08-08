import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireActiveTenant,
  requireServiceRole,
  sha256Hex,
} from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type MeetingProvider = "google_meet" | "zoom" | null;

interface BookingRequest {
  tenant_id: string;
  contact_id: string;
  call_sid?: string;
  date: string;
  time: string;
  duration_minutes?: number;
  call_summary?: string;
  meeting_type?: "online" | "call" | "in_person";
  location?: string;
  meeting_provider_override?: "google_meet" | "zoom";
  idempotency_key?: string;
}

interface GoogleToken {
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  calendar_id: string | null;
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, {
      ...corsHeaders,
      Allow: "POST",
    });
  }

  try {
    requireServiceRole(request);
    const supabase = createServiceClient();
    const body = await request.json() as BookingRequest;
    const validationError = validateRequest(body);
    if (validationError) return jsonResponse({ error: validationError }, 400, corsHeaders);

    await requireActiveTenant(supabase, body.tenant_id);

    const durationMinutes = Math.min(240, Math.max(15, Number(body.duration_minutes || 30)));
    const meetingType = body.meeting_type || "online";
    const [{ data: contact, error: contactError }, { data: settings, error: settingsError }] =
      await Promise.all([
        supabase
          .from("contacts")
          .select("id,name,email,phone_e164,tenant_id,do_not_contact")
          .eq("tenant_id", body.tenant_id)
          .eq("id", body.contact_id)
          .maybeSingle(),
        supabase
          .from("settings")
          .select(
            "timezone,availability_json,booking_rules_json,default_meeting_provider,whatsapp_enabled",
          )
          .eq("tenant_id", body.tenant_id)
          .maybeSingle(),
      ]);
    if (contactError) throw contactError;
    if (settingsError) throw settingsError;
    if (!contact) throw new AuthError("Contact not found in tenant", 404);

    const timezone = typeof settings?.timezone === "string"
      ? settings.timezone
      : "Europe/Rome";
    const startAt = zonedLocalToUtc(body.date, body.time, timezone);
    if (!startAt) return jsonResponse({ error: "Invalid local date or time" }, 400, corsHeaders);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
    const ruleError = validateBookingRules(
      startAt,
      endAt,
      timezone,
      settings?.booking_rules_json,
      settings?.availability_json,
    );
    if (ruleError) return jsonResponse({ error: ruleError }, 409, corsHeaders);

    const idempotencyKey = (body.idempotency_key?.trim() || await sha256Hex(
      `${body.tenant_id}:${body.contact_id}:${startAt.toISOString()}:${durationMinutes}:${body.call_sid || "manual"}`,
    )).slice(0, 250);
    const { data: existing, error: existingError } = await supabase
      .from("appointments")
      .select(
        "id,start_at,end_at,title,meet_link,meeting_provider,meeting_id,calendar_event_id,external_sync_status",
      )
      .eq("tenant_id", body.tenant_id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return jsonResponse({ success: true, duplicate: true, appointment: existing }, 200, corsHeaders);
    }

    const { data: overlap, error: overlapError } = await supabase
      .from("appointments")
      .select("id,start_at,end_at")
      .eq("tenant_id", body.tenant_id)
      .in("status", ["scheduled", "confirmed", "rescheduled"])
      .lt("start_at", endAt.toISOString())
      .gt("end_at", startAt.toISOString())
      .limit(1)
      .maybeSingle();
    if (overlapError) throw overlapError;
    if (overlap) return jsonResponse({ error: "The requested slot is already occupied" }, 409, corsHeaders);

    const { data: googleTokenRow, error: googleTokenError } = await supabase
      .from("google_tokens")
      .select("access_token,refresh_token,token_expires_at,calendar_id")
      .eq("tenant_id", body.tenant_id)
      .maybeSingle();
    if (googleTokenError) throw googleTokenError;
    const googleToken = googleTokenRow as GoogleToken | null;
    let googleAccessToken: string | null = null;
    if (googleToken) {
      googleAccessToken = await getValidGoogleToken(supabase, body.tenant_id, googleToken);
      const busy = await googleCalendarIsBusy(
        googleAccessToken,
        googleToken.calendar_id || "primary",
        startAt,
        endAt,
        timezone,
      );
      if (busy) return jsonResponse({ error: "The requested slot is busy in Google Calendar" }, 409, corsHeaders);
    }

    const provider = resolveProvider(
      meetingType,
      body.meeting_provider_override,
      settings?.default_meeting_provider,
      Boolean(googleAccessToken),
    );
    if ((meetingType === "online" || meetingType === "call") && !provider) {
      return jsonResponse({ error: "No online meeting provider is configured" }, 409, corsHeaders);
    }

    const title = `Appuntamento con ${String(contact.name || "contatto").slice(0, 160)}`;
    const description = buildDescription(contact, body.call_summary);
    const needsExternalSync = Boolean(googleAccessToken || provider === "zoom");
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        tenant_id: body.tenant_id,
        contact_id: body.contact_id,
        title,
        description,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        timezone,
        status: "scheduled",
        created_from: "voice_ai",
        meeting_type: meetingType,
        location: body.location?.trim().slice(0, 1000) || null,
        meeting_provider: provider,
        idempotency_key: idempotencyKey,
        external_sync_status: needsExternalSync ? "pending" : "not_started",
      })
      .select("id")
      .single();
    if (appointmentError?.code === "23P01") {
      return jsonResponse({ error: "The requested slot is already occupied" }, 409, corsHeaders);
    }
    if (appointmentError?.code === "23505") {
      const { data: duplicate, error: duplicateError } = await supabase
        .from("appointments")
        .select("id,start_at,end_at,title,meet_link,meeting_provider,meeting_id")
        .eq("tenant_id", body.tenant_id)
        .eq("idempotency_key", idempotencyKey)
        .single();
      if (duplicateError) throw duplicateError;
      return jsonResponse({ success: true, duplicate: true, appointment: duplicate }, 200, corsHeaders);
    }
    if (appointmentError) throw appointmentError;

    let zoomMeetingId: string | null = null;
    let meetLink: string | null = null;
    let googleEventId: string | null = null;
    let calendarId: string | null = googleToken?.calendar_id || null;

    try {
      if (provider === "zoom") {
        const zoom = await createZoomMeeting(
          title,
          startAt,
          durationMinutes,
          timezone,
          description,
        );
        zoomMeetingId = zoom.meetingId;
        meetLink = zoom.joinUrl;
      }

      if (googleAccessToken && googleToken) {
        calendarId = googleToken.calendar_id || "primary";
        const googleEvent = await createGoogleCalendarEvent(
          googleAccessToken,
          calendarId,
          {
            title,
            description,
            startAt,
            endAt,
            timezone,
            email: typeof contact.email === "string" ? contact.email : null,
            location: body.location?.trim() || meetLink,
            createMeet: provider === "google_meet",
            zoomLink: provider === "zoom" ? meetLink : null,
            idempotencyKey,
          },
        );
        googleEventId = googleEvent.eventId;
        meetLink = googleEvent.meetLink || meetLink;
      } else if (provider === "google_meet") {
        throw new Error("Google Calendar is not connected");
      }

      const { error: syncUpdateError } = await supabase
        .from("appointments")
        .update({
          calendar_event_id: googleEventId,
          google_calendar_id: calendarId,
          meet_link: meetLink,
          meeting_id: zoomMeetingId,
          external_sync_status: needsExternalSync ? "synced" : "not_started",
          external_sync_error_code: null,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", body.tenant_id)
        .eq("id", appointment.id);
      if (syncUpdateError) throw syncUpdateError;
    } catch (error) {
      console.error("[ai-book-appointment] External provider failed", {
        provider,
        error: error instanceof Error ? error.message : String(error),
      });
      await compensateExternalBooking(
        googleAccessToken,
        calendarId,
        googleEventId,
        zoomMeetingId,
      );
      const { error: deleteError } = await supabase
        .from("appointments")
        .delete()
        .eq("tenant_id", body.tenant_id)
        .eq("id", appointment.id);
      if (deleteError) console.error("[ai-book-appointment] Appointment compensation failed", deleteError);
      return jsonResponse({ error: "External calendar or meeting creation failed" }, 502, corsHeaders);
    }

    if (body.call_summary?.trim()) {
      const { error: noteError } = await supabase.from("lead_notes").insert({
        tenant_id: body.tenant_id,
        contact_id: body.contact_id,
        note_text: body.call_summary.trim().slice(0, 4000),
      });
      if (noteError) console.error("[ai-book-appointment] Note creation failed", noteError);
    }

    await Promise.all([
      touchContactActivity(supabase, body.tenant_id, body.contact_id),
      moveContactToStageType(supabase, body.tenant_id, body.contact_id, "appointment_set"),
      completeActiveQueue(supabase, body.tenant_id, body.contact_id, body.date, body.time),
      updateCallLog(
        supabase,
        body.tenant_id,
        body.contact_id,
        body.call_sid,
        appointment.id,
        body.date,
        body.time,
        provider,
      ),
      createReminder(supabase, {
        tenantId: body.tenant_id,
        contactId: body.contact_id,
        appointmentId: appointment.id,
        startAt,
        meetLink,
        title,
        provider,
      }),
    ]);

    if (settings?.whatsapp_enabled && !contact.do_not_contact && contact.phone_e164) {
      await sendConfirmation(
        supabase,
        body.tenant_id,
        body.contact_id,
        startAt,
        timezone,
        meetLink,
      );
    }

    const { error: auditError } = await supabase.from("audit_log").insert({
      tenant_id: body.tenant_id,
      action: "appointment.created_by_voice_ai",
      payload_json: {
        appointment_id: appointment.id,
        contact_id: body.contact_id,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        provider,
        google_event_created: Boolean(googleEventId),
      },
    });
    if (auditError) console.error("[ai-book-appointment] Audit failed", auditError);

    return jsonResponse({
      success: true,
      appointment: {
        id: appointment.id,
        date: body.date,
        time: body.time,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        title,
        meet_link: meetLink,
        meeting_provider: provider,
        meeting_id: zoomMeetingId,
        calendar_event_id: googleEventId,
      },
    }, 201, corsHeaders);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    console.error("[ai-book-appointment] Processing failed", error);
    return jsonResponse(
      { error: status < 500 && error instanceof Error ? error.message : "Appointment booking failed" },
      status,
      corsHeaders,
    );
  }
});

function validateRequest(body: BookingRequest): string | null {
  if (!body.tenant_id || !body.contact_id || !body.date || !body.time) {
    return "tenant_id, contact_id, date and time are required";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return "Invalid date";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)) return "Invalid time";
  if (body.meeting_provider_override &&
    !["google_meet", "zoom"].includes(body.meeting_provider_override)) {
    return "Invalid meeting provider";
  }
  return null;
}

function validateBookingRules(
  startAt: Date,
  endAt: Date,
  timezone: string,
  rawRules: unknown,
  rawAvailability: unknown,
): string | null {
  const now = new Date();
  if (startAt <= now) return "Appointment time must be in the future";
  const rules = isRecord(rawRules) ? rawRules : {};
  const minNoticeHours = finiteNumber(rules.min_notice_hours, 0);
  const maxAdvanceDays = finiteNumber(rules.max_advance_days, 365);
  if (startAt.getTime() - now.getTime() < minNoticeHours * 3_600_000) {
    return "The requested slot does not meet the minimum notice";
  }
  if (startAt.getTime() - now.getTime() > maxAdvanceDays * 86_400_000) {
    return "The requested slot is too far in advance";
  }

  if (isRecord(rawAvailability)) {
    const local = localParts(startAt, timezone);
    const window = rawAvailability[local.weekday];
    if (!isRecord(window) || typeof window.start !== "string" ||
      typeof window.end !== "string") {
      return "The requested day is unavailable";
    }
    const localStart = `${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}`;
    const localEndParts = localParts(endAt, timezone);
    const localEnd = `${String(localEndParts.hour).padStart(2, "0")}:${String(localEndParts.minute).padStart(2, "0")}`;
    if (localStart < window.start || localEnd > window.end) {
      return "The requested time is outside business hours";
    }
  }
  return null;
}

function resolveProvider(
  meetingType: string,
  override: unknown,
  preferred: unknown,
  hasGoogle: boolean,
): MeetingProvider {
  if (meetingType === "in_person") return null;
  const hasZoom = Boolean(
    Deno.env.get("ZOOM_ACCOUNT_ID") &&
      Deno.env.get("ZOOM_CLIENT_ID") &&
      Deno.env.get("ZOOM_CLIENT_SECRET"),
  );
  const requested = override === "google_meet" || override === "zoom"
    ? override
    : preferred === "google_meet" || preferred === "zoom"
    ? preferred
    : null;
  if (requested === "google_meet" && hasGoogle) return "google_meet";
  if (requested === "zoom" && hasZoom) return "zoom";
  if (hasGoogle) return "google_meet";
  if (hasZoom) return "zoom";
  return null;
}

async function getValidGoogleToken(
  supabase: any,
  tenantId: string,
  token: GoogleToken,
): Promise<string> {
  const expiry = new Date(token.token_expires_at || 0).getTime();
  if (token.access_token && expiry > Date.now() + 300_000) return token.access_token;
  if (!token.refresh_token) throw new Error("Google refresh token is unavailable");

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
  const data = await response.json().catch(() => ({})) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!response.ok || !data.access_token) {
    const { error: auditError } = await supabase.from("audit_log").insert({
      tenant_id: tenantId,
      action: "google_oauth.refresh_failed",
      payload_json: {
        provider_status: response.status,
        provider_error_code: data.error?.slice(0, 100) || "unknown",
      },
    });
    if (auditError) console.error("[ai-book-appointment] Google refresh audit failed", auditError);
    throw new AuthError("Google Calendar reconnection required", 409);
  }

  const { error } = await supabase
    .from("google_tokens")
    .update({
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + Number(data.expires_in || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return data.access_token;
}

async function googleCalendarIsBusy(
  accessToken: string,
  calendarId: string,
  startAt: Date,
  endAt: Date,
  timezone: string,
): Promise<boolean> {
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: startAt.toISOString(),
      timeMax: endAt.toISOString(),
      timeZone: timezone,
      items: [{ id: calendarId }],
    }),
  });
  if (response.status === 401 || response.status === 403) {
    throw new AuthError("Google Calendar reconnection required", 409);
  }
  if (!response.ok) throw new Error(`Google freeBusy failed ${response.status}`);
  const data = await response.json() as any;
  return Array.isArray(data.calendars?.[calendarId]?.busy) &&
    data.calendars[calendarId].busy.length > 0;
}

async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  input: {
    title: string;
    description: string;
    startAt: Date;
    endAt: Date;
    timezone: string;
    email: string | null;
    location: string | null;
    createMeet: boolean;
    zoomLink: string | null;
    idempotencyKey: string;
  },
): Promise<{ eventId: string; meetLink: string | null }> {
  const payload: Record<string, unknown> = {
    summary: input.title,
    description: input.zoomLink
      ? `${input.description}\n\nCollegamento riunione: ${input.zoomLink}`
      : input.description,
    start: { dateTime: input.startAt.toISOString(), timeZone: input.timezone },
    end: { dateTime: input.endAt.toISOString(), timeZone: input.timezone },
    attendees: input.email ? [{ email: input.email }] : [],
    location: input.location || undefined,
    extendedProperties: {
      private: {
        app_managed: "true",
        idempotency_key: input.idempotencyKey,
      },
    },
  };
  if (input.createMeet) {
    payload.conferenceData = {
      createRequest: {
        requestId: input.idempotencyKey.slice(0, 100),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const params = input.createMeet ? "?conferenceDataVersion=1&sendUpdates=all" : "?sendUpdates=all";
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  const data = await response.json() as any;
  if (!response.ok || !data.id) throw new Error(`Google event creation failed ${response.status}`);
  const meetLink = data.conferenceData?.entryPoints?.find(
    (entry: any) => entry.entryPointType === "video",
  )?.uri || null;
  return { eventId: data.id, meetLink };
}

async function createZoomMeeting(
  title: string,
  startAt: Date,
  durationMinutes: number,
  timezone: string,
  description: string,
): Promise<{ meetingId: string; joinUrl: string }> {
  const accountId = requiredEnv("ZOOM_ACCOUNT_ID");
  const clientId = requiredEnv("ZOOM_CLIENT_ID");
  const clientSecret = requiredEnv("ZOOM_CLIENT_SECRET");
  const tokenResponse = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "account_credentials",
      account_id: accountId,
    }),
  });
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(`Zoom token failed ${tokenResponse.status}`);
  }

  const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: title,
      type: 2,
      start_time: startAt.toISOString(),
      duration: durationMinutes,
      timezone,
      agenda: description,
      settings: {
        join_before_host: false,
        waiting_room: true,
        host_video: true,
        participant_video: true,
      },
    }),
  });
  const data = await response.json() as { id?: string | number; join_url?: string };
  if (!response.ok || !data.id || !data.join_url) {
    throw new Error(`Zoom meeting creation failed ${response.status}`);
  }
  return { meetingId: String(data.id), joinUrl: data.join_url };
}

async function compensateExternalBooking(
  googleAccessToken: string | null,
  calendarId: string | null,
  googleEventId: string | null,
  zoomMeetingId: string | null,
): Promise<void> {
  if (googleAccessToken && calendarId && googleEventId) {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}?sendUpdates=none`,
      { method: "DELETE", headers: { Authorization: `Bearer ${googleAccessToken}` } },
    ).catch(() => undefined);
  }
  if (zoomMeetingId) {
    try {
      const accountId = requiredEnv("ZOOM_ACCOUNT_ID");
      const clientId = requiredEnv("ZOOM_CLIENT_ID");
      const clientSecret = requiredEnv("ZOOM_CLIENT_SECRET");
      const tokenResponse = await fetch("https://zoom.us/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "account_credentials", account_id: accountId }),
      });
      const token = await tokenResponse.json() as { access_token?: string };
      if (token.access_token) {
        await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(zoomMeetingId)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
      }
    } catch {
      // Compensation is best effort and the original failure is returned.
    }
  }
}

async function touchContactActivity(
  supabase: any,
  tenantId: string,
  contactId: string,
): Promise<void> {
  const { error } = await supabase
    .from("contacts")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", contactId);
  if (error) throw error;
}

async function moveContactToStageType(
  supabase: any,
  tenantId: string,
  contactId: string,
  stageType: string,
): Promise<void> {
  const { data: stage, error: stageError } = await supabase
    .from("stages")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("stage_type", stageType)
    .eq("is_active", true)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (stageError) throw stageError;
  if (!stage) return;

  const { data: current, error: currentError } = await supabase
    .from("contact_stages")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .maybeSingle();
  if (currentError) throw currentError;
  const { error } = current
    ? await supabase
      .from("contact_stages")
      .update({ stage_id: stage.id, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", current.id)
    : await supabase.from("contact_stages").insert({
      tenant_id: tenantId,
      contact_id: contactId,
      stage_id: stage.id,
    });
  if (error) throw error;
}

async function completeActiveQueue(
  supabase: any,
  tenantId: string,
  contactId: string,
  date: string,
  time: string,
): Promise<void> {
  const { error } = await supabase
    .from("call_queue")
    .update({
      status: "booked",
      outcome: "appointment_set",
      notes: `Appuntamento fissato: ${date} ${time}`,
      last_voice_outcome: "appointment_booked",
      locked_at: null,
      worker_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .in("status", ["pending", "no_answer", "processing", "calling"]);
  if (error) throw error;
}

async function updateCallLog(
  supabase: any,
  tenantId: string,
  contactId: string,
  callSid: string | undefined,
  appointmentId: string,
  date: string,
  time: string,
  provider: MeetingProvider,
): Promise<void> {
  if (!callSid) return;
  const { data: callLog, error: readError } = await supabase
    .from("call_logs")
    .select("outcome_json")
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .eq("twilio_call_sid", callSid)
    .maybeSingle();
  if (readError) throw readError;
  if (!callLog) return;
  const outcome = isRecord(callLog.outcome_json) ? callLog.outcome_json : {};
  const { error } = await supabase
    .from("call_logs")
    .update({
      outcome_json: {
        ...outcome,
        action: "appointment_booked",
        appointment_id: appointmentId,
        appointment_date: date,
        appointment_time: time,
        meeting_provider: provider,
      },
    })
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .eq("twilio_call_sid", callSid);
  if (error) throw error;
}

async function createReminder(
  supabase: any,
  input: {
    tenantId: string;
    contactId: string;
    appointmentId: string;
    startAt: Date;
    meetLink: string | null;
    title: string;
    provider: MeetingProvider;
  },
): Promise<void> {
  const reminderAt = new Date(input.startAt.getTime() - 24 * 60 * 60 * 1000);
  if (reminderAt <= new Date()) return;
  const { error } = await supabase.from("reminders").insert({
    tenant_id: input.tenantId,
    contact_id: input.contactId,
    appointment_id: input.appointmentId,
    channel: "whatsapp",
    reminder_type: "reminder_24h",
    when_ts: reminderAt.toISOString(),
    status: "pending",
    payload_json: {
      title: input.title,
      start_at: input.startAt.toISOString(),
      meet_link: input.meetLink,
      meeting_provider: input.provider,
    },
  });
  if (error?.code !== "23505" && error) throw error;
}

async function sendConfirmation(
  supabase: any,
  tenantId: string,
  contactId: string,
  startAt: Date,
  timezone: string,
  meetLink: string | null,
): Promise<void> {
  const { data: template, error: templateError } = await supabase
    .from("whatsapp_templates")
    .select("template_name")
    .eq("tenant_id", tenantId)
    .eq("template_type", "confirmation")
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();
  if (templateError) throw templateError;
  if (!template?.template_name) return;

  const formatted = new Intl.DateTimeFormat("it-IT", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(startAt);
  const { data, error } = await supabase.functions.invoke("send-whatsapp", {
    body: {
      tenant_id: tenantId,
      contact_id: contactId,
      template_name: template.template_name,
      parameters: [formatted, meetLink || ""],
    },
  });
  if (error || !data?.success) {
    console.error("[ai-book-appointment] Confirmation WhatsApp failed", error || data);
  }
}

function buildDescription(contact: any, summary: string | undefined): string {
  const parts = ["Appuntamento fissato tramite ClerkAI"];
  if (summary?.trim()) parts.push(summary.trim().slice(0, 1000));
  if (contact.phone_e164) parts.push(`Telefono: ${String(contact.phone_e164).slice(0, 40)}`);
  if (contact.email) parts.push(`Email: ${String(contact.email).slice(0, 254)}`);
  return parts.join("\n");
}

function zonedLocalToUtc(date: string, time: string, timezone: string): Date | null {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  let timestamp = Date.UTC(year, month - 1, day, hour, minute);
  for (let index = 0; index < 3; index += 1) {
    const local = localParts(new Date(timestamp), timezone);
    const represented = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    const desired = Date.UTC(year, month - 1, day, hour, minute);
    timestamp += desired - represented;
  }
  const result = new Date(timestamp);
  const local = localParts(result, timezone);
  return local.year === year && local.month === month && local.day === day &&
      local.hour === hour && local.minute === minute
    ? result
    : null;
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    weekday: value("weekday").toLowerCase(),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
