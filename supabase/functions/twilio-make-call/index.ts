import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AuthError,
  constantTimeEqual,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireActiveTenant,
  requireUserTenant,
} from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MakeCallRequest {
  contact_id: string;
  tenant_id: string;
  call_queue_id?: string;
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, {
      ...corsHeaders,
      Allow: "POST",
    });
  }

  try {
    const supabase = createServiceClient();
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization") ?? "";
    const suppliedToken = authorization.replace(/^Bearer\s+/i, "");
    const isServiceCall = suppliedToken.length > 0 &&
      constantTimeEqual(suppliedToken, serviceRoleKey);

    const body = await request.json() as MakeCallRequest;
    if (!body.contact_id || !body.tenant_id) {
      return jsonResponse({ error: "contact_id and tenant_id are required" }, 400, corsHeaders);
    }

    if (!isServiceCall) {
      const context = await requireUserTenant(request, supabase);
      if (context.tenantId !== body.tenant_id) {
        throw new AuthError("Cross-tenant call denied", 403);
      }
    }

    await requireActiveTenant(supabase, body.tenant_id);

    const twilioAccountSid = requiredEnv("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = requiredEnv("TWILIO_AUTH_TOKEN");
    const supabaseUrl = requiredEnv("SUPABASE_URL");

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id,name,phone_e164")
      .eq("id", body.contact_id)
      .eq("tenant_id", body.tenant_id)
      .single();
    if (contactError || !contact) throw new Error("Contact not found in tenant");
    if (!contact.phone_e164) throw new Error("Contact has no phone number");

    if (body.call_queue_id) {
      const { data: queueItem, error: queueError } = await supabase
        .from("call_queue")
        .select("id,tenant_id,contact_id,status")
        .eq("id", body.call_queue_id)
        .eq("tenant_id", body.tenant_id)
        .eq("contact_id", body.contact_id)
        .single();
      if (queueError || !queueItem) throw new Error("Call queue item not found in tenant");
      if (!["pending", "no_answer", "processing", "calling"].includes(queueItem.status)) {
        throw new Error(`Call queue item is not callable from status ${queueItem.status}`);
      }
    }

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("caller_id_e164")
      .eq("tenant_id", body.tenant_id)
      .maybeSingle();
    if (settingsError) throw settingsError;

    let fromNumber = settings?.caller_id_e164 as string | null;
    if (!fromNumber) {
      const { data: phoneNumber, error: phoneError } = await supabase
        .from("tenant_phone_numbers")
        .select("phone_number")
        .eq("tenant_id", body.tenant_id)
        .eq("phone_type", "voice")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (phoneError) throw phoneError;
      fromNumber = phoneNumber?.phone_number as string | null;
    }
    if (!fromNumber) throw new Error("No active caller ID configured");

    const contextQuery = new URLSearchParams({
      tenant_id: body.tenant_id,
      contact_id: body.contact_id,
    });
    if (body.call_queue_id) contextQuery.set("queue_id", body.call_queue_id);

    const voiceWebhookUrl = `${supabaseUrl}/functions/v1/twilio-voice-webhook?${contextQuery}`;
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status?${contextQuery}`;
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`;

    const formData = new URLSearchParams({
      To: contact.phone_e164 as string,
      From: fromNumber,
      Url: voiceWebhookUrl,
      StatusCallback: statusCallbackUrl,
      StatusCallbackEvent: "initiated ringing answered completed",
      StatusCallbackMethod: "POST",
      MachineDetection: "Enable",
      MachineDetectionTimeout: "5",
      Record: "true",
      RecordingChannels: "dual",
      RecordingStatusCallback: statusCallbackUrl,
      RecordingStatusCallbackEvent: "completed",
    });

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error("[twilio-make-call] Provider error", twilioResponse.status, errorText);
      throw new Error(`Twilio API error: ${twilioResponse.status}`);
    }

    const callData = await twilioResponse.json() as { sid?: string };
    if (!callData.sid) throw new Error("Twilio response has no call SID");

    if (body.call_queue_id) {
      const { error: attemptError } = await supabase.rpc(
        "increment_call_queue_attempt",
        { p_queue_id: body.call_queue_id, p_tenant_id: body.tenant_id },
      );
      if (attemptError) throw attemptError;

      const { error: queueUpdateError } = await supabase
        .from("call_queue")
        .update({
          status: "calling",
          last_call_sid: callData.sid,
          last_attempt_at: new Date().toISOString(),
          locked_at: null,
          worker_id: null,
          last_error_code: null,
        })
        .eq("id", body.call_queue_id)
        .eq("tenant_id", body.tenant_id);
      if (queueUpdateError) throw queueUpdateError;
    }

    const { data: callLog, error: callLogError } = await supabase
      .from("call_logs")
      .upsert({
        tenant_id: body.tenant_id,
        contact_id: body.contact_id,
        direction: "outbound",
        twilio_call_sid: callData.sid,
      }, { onConflict: "twilio_call_sid" })
      .select("id")
      .single();
    if (callLogError) throw callLogError;

    return jsonResponse({
      success: true,
      call_sid: callData.sid,
      call_log_id: callLog.id,
    }, 200, corsHeaders);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[twilio-make-call] Error", error);
    return jsonResponse({ error: status < 500 ? message : "Call initiation failed" }, status, corsHeaders);
  }
});
