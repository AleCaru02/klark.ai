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

  console.log('[google-calendar-cancel] Token expired, refreshing...');

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
    console.error('[google-calendar-cancel] Token refresh failed:', refreshData);
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
    console.log('[google-calendar-cancel] Request received');

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
    const { tenant_id, appointment_id, reason } = body;

    if (!tenant_id || !appointment_id) {
      return new Response(
        JSON.stringify({ error: 'tenant_id and appointment_id are required' }),
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

    // Get the appointment
    const { data: appointment, error: aptError } = await serviceClient
      .from('appointments')
      .select('*')
      .eq('id', appointment_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (aptError || !appointment) {
      return new Response(
        JSON.stringify({ error: 'Appointment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (appointment.status === 'canceled') {
      return new Response(
        JSON.stringify({ error: 'Appointment already canceled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cancel Zoom meeting if applicable
    let zoomCanceled = false;
    if (appointment.meeting_provider === "zoom" && appointment.meeting_id) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const zoomResponse = await fetch(`${SUPABASE_URL}/functions/v1/zoom-delete-meeting`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ meeting_id: appointment.meeting_id }),
        });
        const zoomResult = await zoomResponse.json();
        zoomCanceled = zoomResult.success === true;
        console.log(`[google-calendar-cancel] Zoom meeting ${appointment.meeting_id}: ${zoomCanceled ? "deleted" : "failed"}`);
      } catch (e) {
        console.error("[google-calendar-cancel] Zoom delete error:", e);
      }
    }

    // Get tokens if we need to cancel on Google
    let googleCanceled = false;
    if (appointment.calendar_event_id && appointment.google_calendar_id) {
      const { data: tokenData } = await serviceClient
        .from('google_tokens')
        .select('*')
        .eq('tenant_id', tenant_id)
        .single();

      if (tokenData) {
        const accessToken = await getValidAccessToken(serviceClient, tenant_id, tokenData);
        
        if (accessToken) {
          const deleteResponse = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(appointment.google_calendar_id)}/events/${encodeURIComponent(appointment.calendar_event_id)}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (deleteResponse.ok || deleteResponse.status === 404) {
            googleCanceled = true;
            console.log('[google-calendar-cancel] Event deleted from Google Calendar');
          } else {
            console.error('[google-calendar-cancel] Failed to delete from Google:', await deleteResponse.text());
          }
        }
      }
    }

    // Update appointment status
    const { error: updateError } = await serviceClient
      .from('appointments')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointment_id);

    if (updateError) {
      console.error('[google-calendar-cancel] Failed to update appointment:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to cancel appointment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record in history
    await serviceClient
      .from('appointments_history')
      .insert({
        tenant_id,
        old_appointment_id: appointment_id,
        new_appointment_id: null,
        reason: reason || 'Cancellazione',
        changed_by_user_id: user.id,
        created_at: new Date().toISOString(),
      });

    // Create cancellation reminder if contact exists
    if (appointment.contact_id) {
      const { data: contact } = await serviceClient
        .from('contacts')
        .select('name, phone_e164')
        .eq('id', appointment.contact_id)
        .single();

      if (contact?.phone_e164) {
        await serviceClient.from('reminders').insert({
          tenant_id,
          contact_id: appointment.contact_id,
          appointment_id,
          channel: 'whatsapp',
          reminder_type: 'canceled',
          when_ts: new Date().toISOString(),
          status: 'pending',
          payload_json: {
            title: appointment.title,
            start_at: appointment.start_at,
            contact_name: contact.name,
            contact_phone: contact.phone_e164,
            reason: reason || 'Cancellazione',
          },
        });
        console.log('[google-calendar-cancel] Created cancellation reminder');
      }
    }

    // Delete any pending reminders for this appointment
    await serviceClient
      .from('reminders')
      .update({ status: 'skipped', error_message: 'Appointment canceled' })
      .eq('appointment_id', appointment_id)
      .eq('status', 'pending')
      .neq('reminder_type', 'canceled');

    // ── AUTO-STAGE: cancel → to_call (so tenant can re-engage) ──
    if (appointment.contact_id) {
      // Add moveContactToStageType inline since it's a single use
      const { data: pipelines } = await serviceClient
        .from("pipelines").select("id").eq("tenant_id", tenant_id).limit(1);
      if (pipelines && pipelines.length > 0) {
        const { data: stages } = await serviceClient
          .from("stages").select("id")
          .eq("pipeline_id", pipelines[0].id)
          .eq("stage_type", "to_call")
          .eq("is_active", true)
          .order("position", { ascending: true })
          .limit(1);
        if (stages && stages.length > 0) {
          const { data: existing } = await serviceClient
            .from("contact_stages").select("id").eq("contact_id", appointment.contact_id).single();
          if (existing) {
            await serviceClient.from("contact_stages")
              .update({ stage_id: stages[0].id, updated_at: new Date().toISOString() })
              .eq("contact_id", appointment.contact_id);
          } else {
            await serviceClient.from("contact_stages")
              .insert({ tenant_id, contact_id: appointment.contact_id, stage_id: stages[0].id });
          }
          console.log(`[google-calendar-cancel] Contact ${appointment.contact_id} → to_call`);
        }
      }
    }

    console.log('[google-calendar-cancel] Appointment canceled:', appointment_id);

    return new Response(
      JSON.stringify({
        success: true,
        appointment_id,
        google_canceled: googleCanceled,
        zoom_canceled: zoomCanceled,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[google-calendar-cancel] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
