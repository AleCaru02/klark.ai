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

  if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
    return tokenData.access_token;
  }

  console.log('[calendar-events] Token expired, refreshing...');

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
    console.error('[calendar-events] Token refresh failed:', refreshData);
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const method = req.method;
    console.log(`[calendar-events] ${method} request received`);

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

    const body = await req.json();
    const { tenant_id, action, event_id, event_data } = body;

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

    // Get service client
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
        JSON.stringify({ error: 'Google Calendar not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get settings for calendar_id
    const { data: settings } = await serviceClient
      .from('settings')
      .select('calendar_id')
      .eq('tenant_id', tenant_id)
      .single();

    const calendarId = settings?.calendar_id || 'primary';

    // Get valid access token
    const accessToken = await getValidAccessToken(serviceClient, tenant_id, tokenData);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Failed to refresh token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;

    switch (action) {
      case 'create': {
        console.log('[calendar-events] Creating event...');
        
        const { summary, description, start_at, end_at, attendees, contact_id } = event_data;

        const eventPayload: any = {
          summary,
          description,
          start: {
            dateTime: start_at,
            timeZone: 'Europe/Rome',
          },
          end: {
            dateTime: end_at,
            timeZone: 'Europe/Rome',
          },
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        };

        if (attendees && attendees.length > 0) {
          eventPayload.attendees = attendees.map((email: string) => ({ email }));
        }

        const createResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventPayload),
          }
        );

        const createdEvent = await createResponse.json();

        if (!createResponse.ok) {
          console.error('[calendar-events] Create failed:', createdEvent);
          return new Response(
            JSON.stringify({ error: 'Failed to create calendar event' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Save appointment to database
        const meetLink = createdEvent.conferenceData?.entryPoints?.find(
          (e: any) => e.entryPointType === 'video'
        )?.uri;

        const { data: appointment, error: appointmentError } = await serviceClient
          .from('appointments')
          .insert({
            tenant_id,
            contact_id: contact_id || null,
            start_at,
            end_at,
            calendar_event_id: createdEvent.id,
            meet_link: meetLink,
            status: 'scheduled',
          })
          .select()
          .single();

        if (appointmentError) {
          console.error('[calendar-events] Failed to save appointment:', appointmentError);
        }

        // Save calendar link for webhook correlation
        if (contact_id) {
          await serviceClient
            .from('calendar_links')
            .insert({
              tenant_id,
              contact_id,
              calendar_event_id: createdEvent.id,
            });
        }

        result = {
          event: createdEvent,
          appointment,
          meet_link: meetLink,
        };
        break;
      }

      case 'update': {
        console.log('[calendar-events] Updating event:', event_id);

        if (!event_id) {
          return new Response(
            JSON.stringify({ error: 'event_id is required for update' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { summary, description, start_at, end_at } = event_data;

        const updatePayload: any = {};
        if (summary) updatePayload.summary = summary;
        if (description) updatePayload.description = description;
        if (start_at) {
          updatePayload.start = { dateTime: start_at, timeZone: 'Europe/Rome' };
        }
        if (end_at) {
          updatePayload.end = { dateTime: end_at, timeZone: 'Europe/Rome' };
        }

        const updateResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event_id)}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatePayload),
          }
        );

        const updatedEvent = await updateResponse.json();

        if (!updateResponse.ok) {
          console.error('[calendar-events] Update failed:', updatedEvent);
          return new Response(
            JSON.stringify({ error: 'Failed to update calendar event' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update appointment in database
        const appointmentUpdate: any = { updated_at: new Date().toISOString() };
        if (start_at) appointmentUpdate.start_at = start_at;
        if (end_at) appointmentUpdate.end_at = end_at;
        appointmentUpdate.status = 'rescheduled';

        await serviceClient
          .from('appointments')
          .update(appointmentUpdate)
          .eq('calendar_event_id', event_id)
          .eq('tenant_id', tenant_id);

        result = { event: updatedEvent };
        break;
      }

      case 'delete': {
        console.log('[calendar-events] Deleting event:', event_id);

        if (!event_id) {
          return new Response(
            JSON.stringify({ error: 'event_id is required for delete' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const deleteResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event_id)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          const errorData = await deleteResponse.text();
          console.error('[calendar-events] Delete failed:', errorData);
          return new Response(
            JSON.stringify({ error: 'Failed to delete calendar event' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update appointment status
        await serviceClient
          .from('appointments')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('calendar_event_id', event_id)
          .eq('tenant_id', tenant_id);

        result = { deleted: true };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: create, update, delete' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`[calendar-events] ${action} completed successfully`);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[calendar-events] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
