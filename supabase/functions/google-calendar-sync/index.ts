import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AuthError,
  constantTimeEqual,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireUserTenant,
} from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GoogleEvent {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
}

interface SyncStats {
  imported_count: number;
  updated_count: number;
  canceled_count: number;
  skipped_count: number;
  errors: string[];
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, {
      ...corsHeaders,
      Allow: "POST",
    });
  }

  const supabase = createServiceClient();

  try {
    const body = await request.json().catch(() => ({})) as {
      tenant_id?: string;
      user_id?: string;
    };
    if (!body.tenant_id) {
      return jsonResponse({ error: "tenant_id is required" }, 400, corsHeaders);
    }

    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const suppliedToken = (request.headers.get("Authorization") ?? "")
      .replace(/^Bearer\s+/i, "");
    const isServiceCall = suppliedToken.length > 0 &&
      constantTimeEqual(suppliedToken, serviceRoleKey);

    let actorUserId: string | null = null;
    if (isServiceCall) {
      actorUserId = typeof body.user_id === "string" ? body.user_id : null;
    } else {
      const caller = await requireUserTenant(request, supabase);
      if (caller.tenantId !== body.tenant_id) {
        throw new AuthError("Cross-tenant calendar sync denied", 403);
      }
      actorUserId = caller.userId;
    }

    const result = await syncTenantCalendar(
      supabase,
      body.tenant_id,
      actorUserId,
    );

    const { error: auditError } = await supabase.from("audit_log").insert({
      tenant_id: body.tenant_id,
      actor_user_id: actorUserId,
      action: "google_calendar.sync_completed",
      payload_json: result,
    });
    if (auditError) console.error("[google-calendar-sync] Audit failed", auditError);

    return jsonResponse({ success: true, ...result }, 200, corsHeaders);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    console.error("[google-calendar-sync] Sync failed", error);
    return jsonResponse(
      { error: status < 500 && error instanceof Error ? error.message : "Calendar sync failed" },
      status,
      corsHeaders,
    );
  }
});

async function syncTenantCalendar(
  supabase: any,
  tenantId: string,
  actorUserId: string | null,
): Promise<SyncStats & { sync_token_saved: boolean; last_sync_at: string }> {
  const stats: SyncStats = {
    imported_count: 0,
    updated_count: 0,
    canceled_count: 0,
    skipped_count: 0,
    errors: [],
  };

  const { data: tokenData, error: tokenError } = await supabase
    .from("google_tokens")
    .select("access_token,refresh_token,token_expires_at,calendar_id,sync_token")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (tokenError) throw tokenError;
  if (!tokenData) throw new AuthError("Google Calendar is not connected", 409);

  const accessToken = await getValidAccessToken(supabase, tenantId, tokenData);
  const calendarId = tokenData.calendar_id || "primary";
  const { events, nextSyncToken } = await fetchCalendarEvents(
    accessToken,
    calendarId,
    tokenData.sync_token || null,
  );

  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select(
      "id,title,description,location,start_at,end_at,timezone,calendar_event_id,meet_link,status",
    )
    .eq("tenant_id", tenantId)
    .eq("google_calendar_id", calendarId);
  if (appointmentsError) throw appointmentsError;

  const byEventId = new Map(
    (appointments ?? [])
      .filter((appointment: any) => appointment.calendar_event_id)
      .map((appointment: any) => [appointment.calendar_event_id, appointment]),
  );

  for (const event of events) {
    if (!event.id) {
      stats.skipped_count += 1;
      continue;
    }

    try {
      const existing = byEventId.get(event.id) as any | undefined;
      if (event.status === "cancelled") {
        if (!existing || existing.status === "canceled") {
          stats.skipped_count += 1;
          continue;
        }
        const { error } = await supabase
          .from("appointments")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("tenant_id", tenantId)
          .eq("id", existing.id);
        if (error) throw error;
        stats.canceled_count += 1;
        continue;
      }

      const times = parseEventTimes(event);
      if (!times) {
        stats.skipped_count += 1;
        continue;
      }

      const meetLink = event.conferenceData?.entryPoints?.find(
        (entry) => entry.entryPointType === "video",
      )?.uri || null;
      const timezone = event.start?.timeZone || event.end?.timeZone || "Europe/Rome";

      if (existing) {
        const timeChanged = existing.start_at !== times.startAt ||
          existing.end_at !== times.endAt;
        const update = {
          title: event.summary?.slice(0, 300) || existing.title || "Senza titolo",
          description: event.description?.slice(0, 5000) || null,
          location: event.location?.slice(0, 1000) || null,
          start_at: times.startAt,
          end_at: times.endAt,
          timezone,
          meet_link: meetLink,
          status: timeChanged ? "rescheduled" : existing.status === "confirmed"
            ? "confirmed"
            : "scheduled",
          updated_at: new Date().toISOString(),
        };
        const changed = timeChanged ||
          existing.title !== update.title ||
          existing.description !== update.description ||
          existing.location !== update.location ||
          existing.meet_link !== update.meet_link ||
          existing.timezone !== update.timezone ||
          existing.status !== update.status;
        if (!changed) {
          stats.skipped_count += 1;
          continue;
        }

        const { error } = await supabase
          .from("appointments")
          .update(update)
          .eq("tenant_id", tenantId)
          .eq("id", existing.id);
        if (error) throw error;

        if (timeChanged) {
          const { error: historyError } = await supabase
            .from("appointments_history")
            .insert({
              tenant_id: tenantId,
              old_appointment_id: existing.id,
              new_appointment_id: existing.id,
              reason: "Orario aggiornato da Google Calendar",
              changed_by_user_id: actorUserId,
              created_at: new Date().toISOString(),
            });
          if (historyError) console.error("[google-calendar-sync] History failed", historyError);
        }

        stats.updated_count += 1;
        continue;
      }

      const { error: insertError } = await supabase.from("appointments").insert({
        tenant_id: tenantId,
        title: event.summary?.slice(0, 300) || "Senza titolo",
        description: event.description?.slice(0, 5000) || null,
        location: event.location?.slice(0, 1000) || null,
        start_at: times.startAt,
        end_at: times.endAt,
        timezone,
        calendar_event_id: event.id,
        google_calendar_id: calendarId,
        meet_link: meetLink,
        status: "scheduled",
        created_from: "google",
      });
      if (insertError?.code === "23505") {
        stats.skipped_count += 1;
      } else if (insertError) {
        throw insertError;
      } else {
        stats.imported_count += 1;
      }
    } catch (error) {
      console.error("[google-calendar-sync] Event failed", {
        event_id: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
      stats.errors.push(`Event ${event.id} failed`);
    }
  }

  if (nextSyncToken) {
    const { error: syncTokenError } = await supabase
      .from("google_tokens")
      .update({
        sync_token: nextSyncToken,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);
    if (syncTokenError) throw syncTokenError;
  }

  return {
    ...stats,
    sync_token_saved: Boolean(nextSyncToken),
    last_sync_at: new Date().toISOString(),
  };
}

async function getValidAccessToken(
  supabase: any,
  tenantId: string,
  tokenData: any,
): Promise<string> {
  const expiresAt = new Date(tokenData.token_expires_at || 0).getTime();
  if (tokenData.access_token && expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokenData.access_token;
  }
  if (!tokenData.refresh_token) {
    throw new AuthError("Google refresh token is unavailable", 409);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: tokenData.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json() as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new Error(`Google token refresh failed: ${data.error || response.status}`);
  }

  const { error } = await supabase
    .from("google_tokens")
    .update({
      access_token: data.access_token,
      token_expires_at: new Date(
        Date.now() + Number(data.expires_in || 3600) * 1000,
      ).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
  if (error) throw error;

  return data.access_token;
}

async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  syncToken: string | null,
): Promise<{ events: GoogleEvent[]; nextSyncToken: string | null }> {
  if (syncToken) {
    const incremental = await fetchPages(accessToken, calendarId, { syncToken });
    if (incremental.expiredSyncToken) {
      return await fetchFullCalendar(accessToken, calendarId);
    }
    return {
      events: incremental.events,
      nextSyncToken: incremental.nextSyncToken,
    };
  }
  return await fetchFullCalendar(accessToken, calendarId);
}

async function fetchFullCalendar(
  accessToken: string,
  calendarId: string,
): Promise<{ events: GoogleEvent[]; nextSyncToken: string | null }> {
  const result = await fetchPages(accessToken, calendarId, {
    singleEvents: "true",
    showDeleted: "true",
    maxResults: "250",
  });
  return { events: result.events, nextSyncToken: result.nextSyncToken };
}

async function fetchPages(
  accessToken: string,
  calendarId: string,
  baseParams: Record<string, string>,
): Promise<{
  events: GoogleEvent[];
  nextSyncToken: string | null;
  expiredSyncToken: boolean;
}> {
  const events: GoogleEvent[] = [];
  let pageToken: string | null = null;
  let nextSyncToken: string | null = null;

  do {
    const params = new URLSearchParams(baseParams);
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (response.status === 410) {
      return { events: [], nextSyncToken: null, expiredSyncToken: true };
    }
    if (!response.ok) {
      throw new Error(`Google Calendar API error ${response.status}`);
    }

    const data = await response.json() as {
      items?: GoogleEvent[];
      nextPageToken?: string;
      nextSyncToken?: string;
    };
    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken || null;
    nextSyncToken = data.nextSyncToken || nextSyncToken;
  } while (pageToken);

  return { events, nextSyncToken, expiredSyncToken: false };
}

function parseEventTimes(
  event: GoogleEvent,
): { startAt: string; endAt: string } | null {
  const start = event.start?.dateTime ||
    (event.start?.date ? `${event.start.date}T00:00:00.000Z` : null);
  const end = event.end?.dateTime ||
    (event.end?.date ? `${event.end.date}T00:00:00.000Z` : null);
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return null;
  }
  if (endDate <= startDate) endDate.setMinutes(startDate.getMinutes() + 30);
  return { startAt: startDate.toISOString(), endAt: endDate.toISOString() };
}
