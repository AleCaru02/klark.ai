import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getValidAccessToken(
  supabase: any,
  tenantId: string,
  tokenData: any
): Promise<string | null> {
  const now = new Date();
  const expiresAt = new Date(tokenData.token_expires_at);

  if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
    return tokenData.access_token;
  }

  console.log('[google-calendar-create] Token expired, refreshing...');

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
    console.error('[google-calendar-create] Token refresh failed:', refreshData);
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[google-calendar-create] Request received');

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

    const body = await req.json();
    const { 
      tenant_id, 
      title, 
      description, 
      location,
      start_at, 
      end_at, 
      timezone = 'Europe/Rome',
      attendees,
      contact_id,
      create_meet = false
    } = body;

    if (!tenant_id || !title || !start_at || !end_at) {
      return new Response(
        JSON.stringify({ error: 'tenant_id, title, start_at, end_at are required' }),
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

    const accessToken = await getValidAccessToken(serviceClient, tenant_id, tokenData);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Failed to refresh token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate appointment ID upfront for anti-loop
    const appointmentId = crypto.randomUUID();

    // Build Google Calendar event with extendedProperties for anti-loop
    const eventPayload: any = {
      summary: title,
      description: description || undefined,
      location: location || undefined,
      start: {
        dateTime: start_at,
        timeZone: timezone,
      },
      end: {
        dateTime: end_at,
        timeZone: timezone,
      },
      // ANTI-LOOP: Mark event as app-managed
      extendedProperties: {
        private: {
          app_managed: 'true',
          app_appointment_id: appointmentId,
        },
      },
    };

    if (attendees && attendees.length > 0) {
      eventPayload.attendees = attendees.map((email: string) => ({ email }));
    }

    if (create_meet) {
      eventPayload.conferenceData = {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    // Create event on Google Calendar
    const createUrl = create_meet
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    const createdEvent = await createResponse.json();

    if (!createResponse.ok) {
      console.error('[google-calendar-create] Failed to create event:', createdEvent);
      return new Response(
        JSON.stringify({ error: 'Failed to create event on Google Calendar', details: createdEvent }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[google-calendar-create] Event created on Google:', createdEvent.id);

    // Extract meet link
    let meetLink: string | null = null;
    if (createdEvent.conferenceData?.entryPoints) {
      const videoEntry = createdEvent.conferenceData.entryPoints.find(
        (e: any) => e.entryPointType === 'video'
      );
      if (videoEntry) {
        meetLink = videoEntry.uri;
      }
    }

    // Insert appointment in database with pre-generated ID
    const { data: appointment, error: appointmentError } = await serviceClient
      .from('appointments')
      .insert({
        id: appointmentId, // Use the pre-generated ID for anti-loop
        tenant_id,
        contact_id: contact_id || null,
        title,
        description: description || null,
        location: location || null,
        start_at,
        end_at,
        timezone,
        calendar_event_id: createdEvent.id,
        google_calendar_id: calendarId,
        meet_link: meetLink,
        status: 'scheduled',
        created_from: 'app',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (appointmentError) {
      console.error('[google-calendar-create] Failed to save appointment:', appointmentError);
      // Try to delete the Google event since we couldn't save locally
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(createdEvent.id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      return new Response(
        JSON.stringify({ error: 'Failed to save appointment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[google-calendar-create] Appointment created:', appointment.id);

    return new Response(
      JSON.stringify({
        success: true,
        appointment,
        google_event_id: createdEvent.id,
        meet_link: meetLink,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[google-calendar-create] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
