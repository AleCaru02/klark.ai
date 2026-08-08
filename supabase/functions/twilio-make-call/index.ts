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
  test_mode?: boolean;
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
    const testMode = body.test_mode === true;
    if (!body.contact_id || !body.tenant_id) {
      return jsonResponse({ error: "contact_id and tenant_id are required" }, 400, corsHeaders);
    }
    if (testMode && body.call_queue_id) {
      throw new AuthError("Test calls cannot use the automated call queue", 400);
    }

    if (testMode) {
      if (isServiceCall) {
        throw new AuthError("Voice test mode requires an authenticated platform admin", 403);
      }
      await requirePlatformAdmin(supabase, suppliedToken);
    } else if (!isServiceCall) {
      const context = await requireUserTenant(request, supabase);
      if (context.tenantId !== body.tenant_id) {
        throw new AuthError("Cross-tenant call denied", 403);
      }
    }

    await requireActiveTenant(supabase, body.tenant_id);

    const parentAccountSid = requiredEnv("TWILIO_ACCOUNT_SID");
    const parentAuthToken = requiredEnv("TWILIO_AUTH_TOKEN");
    const supabaseUrl = requiredEnv("SUPABASE_URL");

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id,name,phone_e164,do_not_contact,callback_requested,callback_requested_at,contact_permission_source")
      .eq("id", body.contact_id)
      .eq("tenant_id", body.tenant_id)
      .single();
    if (contactError || !contact) throw new Error("Contact not found in tenant");
    if (!contact.phone_e164) throw new Error("Contact has no phone number");
    if (contact.do_not_contact === true) {
      throw new AuthError("Contact is marked do-not-contact", 409);
    }
    if (!testMode) {
      const hasCallbackEvidence = contact.callback_requested === true &&
        Boolean(contact.callback_requested_at) &&
        typeof contact.contact_permission_source === "string" &&
        contact.contact_permission_source.trim().length > 0;
      if (!hasCallbackEvidence) {
        throw new AuthError("Verified callback permission is required for outbound Voice", 409);
      }
    }

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
      .select("voice_enabled,voice_runtime_verified,voice_test_mode,recording_opt_in")
      .eq("tenant_id", body.tenant_id)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings) throw new Error("Voice settings are missing");

    if (testMode) {
      if (settings.voice_test_mode !== true) {
        throw new AuthError("Voice test mode is not enabled for this tenant", 409);
      }
    } else if (settings.voice_enabled !== true || settings.voice_runtime_verified !== true) {
      throw new AuthError("Voice runtime is not ready for this tenant", 409);
    }

    let phoneQuery = supabase
      .from("tenant_phone_numbers")
      .select("phone_number,twilio_sid,twilio_subaccount_sid,status,provider_status,regulatory_status,regulatory_verified_at")
      .eq("tenant_id", body.tenant_id)
      .eq("phone_type", "voice")
      .eq("provider_status", "verified")
      .eq("regulatory_status", "approved")
      .not("regulatory_verified_at", "is", null)
      .limit(1);
    phoneQuery = testMode
      ? phoneQuery.in("status", ["pending", "active"])
      : phoneQuery.eq("status", "active");
    const { data: phoneNumber, error: phoneError } = await phoneQuery.maybeSingle();
    if (phoneError) throw phoneError;
    if (!phoneNumber?.phone_number || !phoneNumber.twilio_subaccount_sid) {
      throw new Error(testMode ? "No testable Voice number configured" : "No active Voice number configured");
    }

    const readinessRpc = testMode ? "is_testable_voice_number" : "is_compliant_voice_number";
    const { data: numberReady, error: numberReadyError } = await supabase.rpc(readinessRpc, {
      p_tenant_id: body.tenant_id,
      p_phone_number: phoneNumber.phone_number,
    });
    if (numberReadyError) throw numberReadyError;
    if (numberReady !== true) {
      throw new Error(testMode ? "Voice number is not testable" : "Voice number is not compliant");
    }

    const subaccountSid = String(phoneNumber.twilio_subaccount_sid);
    if (!/^AC[0-9A-Fa-f]{32}$/.test(subaccountSid)) {
      throw new Error("Invalid Twilio subaccount SID");
    }

    const contextQuery = new URLSearchParams({
      tenant_id: body.tenant_id,
      contact_id: body.contact_id,
    });
    if (body.call_queue_id) contextQuery.set("queue_id", body.call_queue_id);
    if (testMode) contextQuery.set("test_mode", "1");

    const voiceWebhookUrl = `${supabaseUrl}/functions/v1/twilio-voice-webhook?${contextQuery}`;
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status?${contextQuery}`;
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${subaccountSid}/Calls.json`;

    const formData = new URLSearchParams({
      To: contact.phone_e164 as string,
      From: phoneNumber.phone_number as string,
      Url: voiceWebhookUrl,
      StatusCallback: statusCallbackUrl,
      StatusCallbackEvent: "initiated ringing answered completed",
      StatusCallbackMethod: "POST",
      MachineDetection: "Enable",
      MachineDetectionTimeout: "5",
    });

    const recordingRequested = settings.recording_opt_in === true;
    if (recordingRequested) {
      formData.set("Record", "true");
      formData.set("RecordingChannels", "dual");
      formData.set("RecordingStatusCallback", statusCallbackUrl);
      formData.set("RecordingStatusCallbackEvent", "completed");
    }

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${parentAccountSid}:${parentAuthToken}`)}`,
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
        outcome_json: {
          test_mode: testMode,
          recording_requested: recordingRequested,
          queue_id: body.call_queue_id ?? null,
        },
      }, { onConflict: "twilio_call_sid" })
      .select("id")
      .single();
    if (callLogError) throw callLogError;

    return jsonResponse({
      success: true,
      call_sid: callData.sid,
      call_log_id: callLog.id,
      test_mode: testMode,
      recording_requested: recordingRequested,
    }, 200, corsHeaders);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[twilio-make-call] Error", error);
    return jsonResponse({ error: status < 500 ? message : "Call initiation failed" }, status, corsHeaders);
  }
});

async function requirePlatformAdmin(
  supabase: ReturnType<typeof createServiceClient>,
  accessToken: string,
): Promise<void> {
  if (!accessToken) throw new AuthError("Missing bearer token", 401);
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  const userId = userData.user?.id;
  if (userError || !userId) throw new AuthError("Invalid bearer token", 401);
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_platform_admin", {
    _user_id: userId,
  });
  if (adminError) throw adminError;
  if (isAdmin !== true) throw new AuthError("Platform admin required for Voice test mode", 403);
}
