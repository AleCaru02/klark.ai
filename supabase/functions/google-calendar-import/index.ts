import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to refresh tokens if expired
async function getValidAccessToken(
  supabase: any,
  tenantId: string,
  tokenData: any
): Promise<string | null> {
  const now = new Date();
  const expiresAt = new Date(tokenData.token_expires_at);

  // If token expires in more than 5 minutes, use it
  if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
    return tokenData.access_token;
  }

  console.log('[google-calendar-import] Token expired, refreshing...');

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const refreshData = await refreshResponse.json();

  if (!refreshResponse.ok || !refreshData.access_token) {
    console.error('[google-calendar-import] Token refresh failed:', refreshData);
    return null;
  }

  const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000);

  await supabase
    .from('google_tokens')
    .update({
      access_token: refreshData.access_token,
      token_expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);

  return refreshData.access_token;
}

// Parse Google Calendar event to appointment format
function parseGoogleEvent(event: any, tenantId: string, calendarId: string): any | null {
  // Skip cancelled events
  if (event.status === 'cancelled') {
    return null;
  }

  let startAt: string;
  let endAt: string;
  let isAllDay = false;

  // Handle all-day events (date only) vs timed events (dateTime)
  if (event.start?.date) {
    // All-day event: date format is YYYY-MM-DD
    isAllDay = true;
    // Set to start of day in Rome timezone
    startAt = `${event.start.date}T00:00:00+01:00`;
    endAt = event.end?.date 
      ? `${event.end.date}T00:00:00+01:00`
      : `${event.start.date}T23:59:59+01:00`;
  } else if (event.start?.dateTime) {
    startAt = event.start.dateTime;
    endAt = event.end?.dateTime || event.start.dateTime;
  } else {
    console.log('[google-calendar-import] Skipping event without start time:', event.id);
    return null;
  }

  // Extract meet link if present
  let meetLink: string | null = null;
  if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(
      (e: any) => e.entryPointType === 'video'
    );
    if (videoEntry) {
      meetLink = videoEntry.uri;
    }
  }

  // Map status
  let status: 'scheduled' | 'canceled' = 'scheduled';
  if (event.status === 'cancelled') {
    status = 'canceled';
  }

  return {
    tenant_id: tenantId,
    calendar_event_id: event.id,
    google_calendar_id: calendarId,
    title: event.summary || 'Senza titolo',
    description: event.description || null,
    location: event.location || null,
    start_at: startAt,
    end_at: endAt,
    timezone: event.start?.timeZone || 'Europe/Rome',
    status,
    meet_link: meetLink,
    created_from: 'google',
    updated_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[google-calendar-import] Request received');

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { tenant_id, days_past = 60, days_future = 365 } = body;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to tenant
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get service client for reading tokens
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get tokens
    const { data: tokenData, error: tokenError } = await serviceClient
      .from('google_tokens')
      .select('*')
      .eq('tenant_id', tenant_id)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'Google Calendar not connected', code: 'NOT_CONNECTED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const calendarId = tokenData.calendar_id || 'primary';

    // Get valid access token
    const accessToken = await getValidAccessToken(serviceClient, tenant_id, tokenData);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Failed to refresh token', code: 'TOKEN_REFRESH_FAILED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate date range
    const now = new Date();
    const timeMin = new Date(now.getTime() - days_past * 24 * 60 * 60 * 1000);
    const timeMax = new Date(now.getTime() + days_future * 24 * 60 * 60 * 1000);

    console.log(`[google-calendar-import] Fetching events from ${timeMin.toISOString()} to ${timeMax.toISOString()}`);

    // Fetch events from Google Calendar (paginated)
    const allEvents: any[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      });

      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const eventsResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const eventsData = await eventsResponse.json();

      if (!eventsResponse.ok) {
        console.error('[google-calendar-import] Failed to fetch events:', eventsData);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch events from Google Calendar', details: eventsData }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (eventsData.items) {
        allEvents.push(...eventsData.items);
      }

      pageToken = eventsData.nextPageToken;
    } while (pageToken);

    console.log(`[google-calendar-import] Fetched ${allEvents.length} events from Google Calendar`);

    // Get existing appointments for comparison
    const { data: existingAppointments } = await serviceClient
      .from('appointments')
      .select('id, calendar_event_id, updated_at, title, start_at, end_at, location, description')
      .eq('tenant_id', tenant_id)
      .eq('google_calendar_id', calendarId);

    const existingMap = new Map(
      (existingAppointments || []).map((apt) => [apt.calendar_event_id, apt])
    );

    // Process events
    const stats = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      total_fetched: allEvents.length,
    };

    const toInsert: any[] = [];
    const toUpdate: { id: string; data: any }[] = [];

    for (const event of allEvents) {
      try {
        const appointment = parseGoogleEvent(event, tenant_id, calendarId);

        if (!appointment) {
          stats.skipped++;
          continue;
        }

        const existing = existingMap.get(event.id);

        if (existing) {
          // Check if update is needed (compare key fields)
          const needsUpdate =
            existing.title !== appointment.title ||
            existing.start_at !== appointment.start_at ||
            existing.end_at !== appointment.end_at ||
            existing.location !== appointment.location ||
            existing.description !== appointment.description;

          if (needsUpdate) {
            toUpdate.push({
              id: existing.id,
              data: appointment,
            });
          } else {
            stats.skipped++;
          }
        } else {
          // New event
          toInsert.push({
            ...appointment,
            created_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('[google-calendar-import] Error processing event:', event.id, err);
        stats.errors++;
      }
    }

    // Batch insert new appointments
    if (toInsert.length > 0) {
      const { error: insertError } = await serviceClient
        .from('appointments')
        .insert(toInsert);

      if (insertError) {
        console.error('[google-calendar-import] Insert error:', insertError);
        stats.errors += toInsert.length;
      } else {
        stats.imported = toInsert.length;
      }
    }

    // Update existing appointments
    for (const { id, data } of toUpdate) {
      const { error: updateError } = await serviceClient
        .from('appointments')
        .update(data)
        .eq('id', id);

      if (updateError) {
        console.error('[google-calendar-import] Update error:', updateError);
        stats.errors++;
      } else {
        stats.updated++;
      }
    }

    // Update last sync timestamp in settings
    await serviceClient
      .from('settings')
      .update({ updated_at: new Date().toISOString() })
      .eq('tenant_id', tenant_id);

    console.log('[google-calendar-import] Import completed:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        calendar_id: calendarId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[google-calendar-import] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
