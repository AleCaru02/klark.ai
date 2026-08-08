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

  console.log('[google-calendar-reschedule] Token expired, refreshing...');

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
    console.error('[google-calendar-reschedule] Token refresh failed:', refreshData);
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
    console.log('[google-calendar-reschedule] Request received');

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
      old_appointment_id,
      new_start_at,
      new_end_at,
      reason = 'Spostamento appuntamento'
    } = body;

    if (!tenant_id || !old_appointment_id || !new_start_at || !new_end_at) {
      return new Response(
        JSON.stringify({ error: 'tenant_id, old_appointment_id, new_start_at, new_end_at are required' }),
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

    // Get the old appointment
    const { data: oldAppointment, error: aptError } = await serviceClient
      .from('appointments')
      .select('*')
      .eq('id', old_appointment_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (aptError || !oldAppointment) {
      return new Response(
        JSON.stringify({ error: 'Appointment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (oldAppointment.status === 'canceled') {
      return new Response(
        JSON.stringify({ error: 'Cannot reschedule a canceled appointment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tokens
    const { data: tokenData } = await serviceClient
      .from('google_tokens')
      .select('*')
      .eq('tenant_id', tenant_id)
      .single();

    let accessToken: string | null = null;
    let calendarId = oldAppointment.google_calendar_id || tokenData?.calendar_id || 'primary';

    if (tokenData) {
      accessToken = await getValidAccessToken(serviceClient, tenant_id, tokenData);
    }

    let newGoogleEventId: string | null = null;
    let newMeetLink: string | null = null;

    // Generate new appointment ID upfront for anti-loop
    const newAppointmentId = crypto.randomUUID();

    // Step 1: Create NEW event on Google Calendar
    if (accessToken) {
      const eventPayload: any = {
        summary: oldAppointment.title || 'Appuntamento',
        description: oldAppointment.description || undefined,
        location: oldAppointment.location || undefined,
        start: {
          dateTime: new_start_at,
          timeZone: oldAppointment.timezone || 'Europe/Rome',
        },
        end: {
          dateTime: new_end_at,
          timeZone: oldAppointment.timezone || 'Europe/Rome',
        },
        // ANTI-LOOP: Mark event as app-managed
        extendedProperties: {
          private: {
            app_managed: 'true',
            app_appointment_id: newAppointmentId,
          },
        },
      };

      // If old appointment had a meet link, create one for new too
      if (oldAppointment.meet_link) {
        eventPayload.conferenceData = {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }

      const createUrl = oldAppointment.meet_link
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

      if (createResponse.ok) {
        newGoogleEventId = createdEvent.id;
        console.log('[google-calendar-reschedule] New event created on Google:', newGoogleEventId);

        // Extract meet link
        if (createdEvent.conferenceData?.entryPoints) {
          const videoEntry = createdEvent.conferenceData.entryPoints.find(
            (e: any) => e.entryPointType === 'video'
          );
          if (videoEntry) {
            newMeetLink = videoEntry.uri;
          }
        }
      } else {
        console.error('[google-calendar-reschedule] Failed to create new event:', createdEvent);
      }

      // Step 2: Delete OLD event from Google Calendar
      if (oldAppointment.calendar_event_id) {
        const deleteResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(oldAppointment.calendar_event_id)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (deleteResponse.ok || deleteResponse.status === 404) {
          console.log('[google-calendar-reschedule] Old event deleted from Google');
        } else {
          console.error('[google-calendar-reschedule] Failed to delete old event');
        }
      }
    }

    // Step 3: Create NEW appointment record with pre-generated ID
    const { data: newAppointment, error: newAptError } = await serviceClient
      .from('appointments')
      .insert({
        id: newAppointmentId, // Use pre-generated ID for anti-loop
        tenant_id,
        contact_id: oldAppointment.contact_id,
        title: oldAppointment.title,
        description: oldAppointment.description,
        location: oldAppointment.location,
        start_at: new_start_at,
        end_at: new_end_at,
        timezone: oldAppointment.timezone || 'Europe/Rome',
        calendar_event_id: newGoogleEventId,
        google_calendar_id: calendarId,
        meet_link: newMeetLink || oldAppointment.meet_link,
        status: 'scheduled', // New appointment starts as scheduled
        created_from: 'app',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (newAptError || !newAppointment) {
      console.error('[google-calendar-reschedule] Failed to create new appointment:', newAptError);
      return new Response(
        JSON.stringify({ error: 'Failed to create new appointment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Update OLD appointment - set status=canceled and replaced_by_id
    const { error: updateOldError } = await serviceClient
      .from('appointments')
      .update({
        status: 'canceled',
        replaced_by_id: newAppointment.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', old_appointment_id);

    if (updateOldError) {
      console.error('[google-calendar-reschedule] Failed to update old appointment:', updateOldError);
    }

    // Step 5: Write to appointments_history
    const { error: historyError } = await serviceClient
      .from('appointments_history')
      .insert({
        tenant_id,
        old_appointment_id,
        new_appointment_id: newAppointment.id,
        reason,
        changed_by_user_id: user.id,
        created_at: new Date().toISOString(),
      });

    if (historyError) {
      console.error('[google-calendar-reschedule] Failed to write history:', historyError);
    }

    // Step 6: Create rescheduled reminder if contact exists
    if (oldAppointment.contact_id) {
      const { data: contact } = await serviceClient
        .from('contacts')
        .select('name, phone_e164')
        .eq('id', oldAppointment.contact_id)
        .single();

      if (contact?.phone_e164) {
        const meetLink = newMeetLink || oldAppointment.meet_link;

        // Create rescheduled notification
        await serviceClient.from('reminders').insert({
          tenant_id,
          contact_id: oldAppointment.contact_id,
          appointment_id: newAppointment.id,
          channel: 'whatsapp',
          reminder_type: 'rescheduled',
          when_ts: new Date().toISOString(),
          status: 'pending',
          payload_json: {
            title: newAppointment.title,
            old_start_at: oldAppointment.start_at,
            new_start_at: newAppointment.start_at,
            meet_link: meetLink,
            contact_name: contact.name,
            contact_phone: contact.phone_e164,
          },
        });

        // Create 24h reminder for new appointment
        const newStartDate = new Date(new_start_at);
        const reminder24h = new Date(newStartDate.getTime() - 24 * 60 * 60 * 1000);
        
        if (reminder24h > new Date()) {
          await serviceClient.from('reminders').insert({
            tenant_id,
            contact_id: oldAppointment.contact_id,
            appointment_id: newAppointment.id,
            channel: 'whatsapp',
            reminder_type: 'reminder_24h',
            when_ts: reminder24h.toISOString(),
            status: 'pending',
            payload_json: {
              title: newAppointment.title,
              start_at: newAppointment.start_at,
              meet_link: meetLink,
              contact_name: contact.name,
              contact_phone: contact.phone_e164,
            },
          });
        }

        console.log('[google-calendar-reschedule] Created reschedule reminders');
      }
    }

    // Skip old appointment's pending reminders
    await serviceClient
      .from('reminders')
      .update({ status: 'skipped', error_message: 'Appointment rescheduled' })
      .eq('appointment_id', old_appointment_id)
      .eq('status', 'pending');

    console.log('[google-calendar-reschedule] Reschedule completed:', {
      old: old_appointment_id,
      new: newAppointment.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        old_appointment_id,
        new_appointment: newAppointment,
        google_event_id: newGoogleEventId,
        meet_link: newMeetLink || oldAppointment.meet_link,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[google-calendar-reschedule] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
