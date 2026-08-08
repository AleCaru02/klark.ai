import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SimulateInboundRequest {
  tenant_id: string;
  lead_id: string;
  appointment_id?: string;
  text: string;
}

// Command parser - shared logic that will be used by real webhook too
function parseWhatsAppCommand(text: string): {
  command: "confirm" | "reschedule" | "cancel" | "unknown";
  normalized: string;
} {
  const normalized = text.toUpperCase().trim();
  
  // Check for confirmation commands
  if (
    normalized.includes("CONFERMO") ||
    normalized.includes("CONFERMATO") ||
    normalized === "OK" ||
    normalized === "SI" ||
    normalized === "SÌ" ||
    normalized.includes("CONFERMA")
  ) {
    return { command: "confirm", normalized };
  }
  
  // Check for reschedule commands
  if (
    normalized.includes("SPOSTA") ||
    normalized.includes("SPOSTARE") ||
    normalized.includes("RIPROGRAMMA") ||
    normalized.includes("CAMBIA DATA") ||
    normalized.includes("CAMBIO DATA")
  ) {
    return { command: "reschedule", normalized };
  }
  
  // Check for cancellation commands
  if (
    normalized.includes("ANNULLA") ||
    normalized.includes("CANCELLA") ||
    normalized.includes("DISDICO") ||
    normalized.includes("DISDIRE") ||
    normalized === "NO"
  ) {
    return { command: "cancel", normalized };
  }
  
  return { command: "unknown", normalized };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SimulateInboundRequest = await req.json();
    const { tenant_id, lead_id, appointment_id, text } = body;

    if (!tenant_id || !lead_id || !text) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[whatsapp-simulate-inbound] Processing: tenant=${tenant_id}, lead=${lead_id}, text="${text}"`);

    // Get lead info
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, phone_e164, appointment_id, handoff_status, status")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      console.error("[whatsapp-simulate-inbound] Lead not found:", leadError);
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use provided appointment_id or lead's appointment_id
    const effectiveAppointmentId = appointment_id || lead.appointment_id;

    // Save inbound message
    const { data: savedMessage, error: msgError } = await supabase
      .from("whatsapp_messages")
      .insert({
        tenant_id,
        lead_id,
        appointment_id: effectiveAppointmentId,
        wa_from: lead.phone_e164 || "unknown",
        text,
        direction: "in",
        message_type: "reply",
        delivery_status: "simulated",
        message_id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ts: new Date().toISOString(),
      })
      .select()
      .single();

    if (msgError) {
      console.error("[whatsapp-simulate-inbound] Failed to save message:", msgError);
    }

    // Parse command
    const { command, normalized } = parseWhatsAppCommand(text);
    console.log(`[whatsapp-simulate-inbound] Parsed command: ${command} from "${normalized}"`);

    let result: {
      command: string;
      action_taken: string;
      appointment_status?: string;
      lead_status?: string;
      handoff_status?: string;
    } = {
      command,
      action_taken: "none",
    };

    if (effectiveAppointmentId) {
      // Get appointment
      const { data: appointment } = await supabase
        .from("appointments")
        .select("id, status")
        .eq("id", effectiveAppointmentId)
        .single();

      if (appointment) {
        switch (command) {
          case "confirm": {
            // Update appointment status to confirmed
            await supabase
              .from("appointments")
              .update({ status: "confirmed" })
              .eq("id", effectiveAppointmentId);

            // Update lead: handoff to HUMAN
            await supabase
              .from("leads")
              .update({ 
                handoff_status: "HUMAN",
                last_contact_at: new Date().toISOString(),
              })
              .eq("id", lead_id);

            // Create interaction
            await supabase.from("interactions").insert({
              tenant_id,
              lead_id,
              channel: "whatsapp",
              direction: "in",
              content: `Appuntamento confermato via WhatsApp: "${text}"`,
              outcome: "appointment_confirmed",
              meta: { simulated: true, command: "confirm" },
            });

            // Cancel pending reminders for this appointment (except reminder_24h already sent)
            await supabase
              .from("reminders")
              .update({ status: "skipped" })
              .eq("appointment_id", effectiveAppointmentId)
              .eq("status", "pending")
              .eq("reminder_type", "confirmation");

            result = {
              command,
              action_taken: "appointment_confirmed",
              appointment_status: "confirmed",
              lead_status: lead.status,
              handoff_status: "HUMAN",
            };
            break;
          }

          case "reschedule": {
            // Update appointment status to rescheduled
            await supabase
              .from("appointments")
              .update({ status: "rescheduled" })
              .eq("id", effectiveAppointmentId);

            // Lead stays with AI for rescheduling
            await supabase
              .from("leads")
              .update({ 
                last_contact_at: new Date().toISOString(),
              })
              .eq("id", lead_id);

            // Create interaction
            await supabase.from("interactions").insert({
              tenant_id,
              lead_id,
              channel: "whatsapp",
              direction: "in",
              content: `Richiesta spostamento appuntamento: "${text}"`,
              outcome: "rescheduled_request",
              meta: { simulated: true, command: "reschedule" },
            });

            // Cancel pending reminders
            await supabase
              .from("reminders")
              .update({ status: "skipped" })
              .eq("appointment_id", effectiveAppointmentId)
              .eq("status", "pending");

            result = {
              command,
              action_taken: "reschedule_requested",
              appointment_status: "rescheduled",
              lead_status: lead.status,
              handoff_status: "AI",
            };
            break;
          }

          case "cancel": {
            // Update appointment status to cancelled
            await supabase
              .from("appointments")
              .update({ status: "cancelled" })
              .eq("id", effectiveAppointmentId);

            // Update lead status
            await supabase
              .from("leads")
              .update({ 
                status: "LOST",
                last_contact_at: new Date().toISOString(),
              })
              .eq("id", lead_id);

            // Create interaction
            await supabase.from("interactions").insert({
              tenant_id,
              lead_id,
              channel: "whatsapp",
              direction: "in",
              content: `Appuntamento annullato via WhatsApp: "${text}"`,
              outcome: "cancelled",
              meta: { simulated: true, command: "cancel" },
            });

            // Cancel all pending reminders
            await supabase
              .from("reminders")
              .update({ status: "skipped" })
              .eq("appointment_id", effectiveAppointmentId)
              .eq("status", "pending");

            result = {
              command,
              action_taken: "appointment_cancelled",
              appointment_status: "cancelled",
              lead_status: "LOST",
              handoff_status: lead.handoff_status || "AI",
            };
            break;
          }

          default: {
            // Unknown command - just log interaction
            await supabase.from("interactions").insert({
              tenant_id,
              lead_id,
              channel: "whatsapp",
              direction: "in",
              content: `Messaggio WhatsApp non riconosciuto: "${text}"`,
              outcome: "none",
              meta: { simulated: true, command: "unknown" },
            });

            result = {
              command: "unknown",
              action_taken: "logged_only",
            };
          }
        }
      }
    } else {
      // No appointment - just log the interaction
      await supabase.from("interactions").insert({
        tenant_id,
        lead_id,
        channel: "whatsapp",
        direction: "in",
        content: `Messaggio WhatsApp (no appuntamento): "${text}"`,
        outcome: "none",
        meta: { simulated: true, command },
      });

      result = {
        command,
        action_taken: "logged_only_no_appointment",
      };
    }

    console.log(`[whatsapp-simulate-inbound] Result:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: savedMessage?.id,
        ...result,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[whatsapp-simulate-inbound] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
