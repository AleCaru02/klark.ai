import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createServiceClient,
  markProviderEventFailed,
  markProviderEventProcessed,
  registerProviderEvent,
  requiredEnv,
  sha256Hex,
  verifyTwilioFormSignature,
} from "../_shared/security.ts";

serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await request.text();
  const form = new URLSearchParams(rawBody);
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();
  if (!authToken) return new Response("Webhook unavailable", { status: 503 });

  const validSignature = await verifyTwilioFormSignature(
    request.url,
    form,
    request.headers.get("X-Twilio-Signature"),
    authToken,
  );
  if (!validSignature) return new Response("Unauthorized", { status: 401 });

  const callSid = form.get("CallSid") || "";
  const callStatus = form.get("CallStatus") || "";
  const recordingSid = form.get("RecordingSid") || "";
  if (!callSid) return new Response("Missing CallSid", { status: 400 });

  const supabase = createServiceClient();
  const url = new URL(request.url);
  let tenantId = url.searchParams.get("tenant_id");
  let contactId = url.searchParams.get("contact_id");
  const queueId = url.searchParams.get("queue_id");

  try {
    if (queueId) {
      const { data: queue, error: queueError } = await supabase
        .from("call_queue")
        .select("id,tenant_id,contact_id,last_call_sid,attempt_count,max_attempts,callback_time")
        .eq("id", queueId)
        .maybeSingle();
      if (queueError) throw queueError;
      if (!queue) return new Response("Unknown queue", { status: 404 });
      if (tenantId && tenantId !== queue.tenant_id) return new Response("Tenant mismatch", { status: 403 });
      if (contactId && contactId !== queue.contact_id) return new Response("Contact mismatch", { status: 403 });
      if (queue.last_call_sid && queue.last_call_sid !== callSid) {
        return new Response("Call mismatch", { status: 403 });
      }
      tenantId = queue.tenant_id;
      contactId = queue.contact_id;
    } else {
      const { data: callLog, error: callLogError } = await supabase
        .from("call_logs")
        .select("tenant_id,contact_id")
        .eq("twilio_call_sid", callSid)
        .maybeSingle();
      if (callLogError) throw callLogError;
      if (callLog) {
        if (tenantId && tenantId !== callLog.tenant_id) return new Response("Tenant mismatch", { status: 403 });
        if (contactId && contactId !== callLog.contact_id) return new Response("Contact mismatch", { status: 403 });
        tenantId = callLog.tenant_id;
        contactId = callLog.contact_id;
      }
    }

    if (!tenantId) return new Response("Unknown tenant", { status: 404 });

    const sequence = form.get("SequenceNumber") ||
      form.get("Timestamp") ||
      form.get("RecordingStatus") ||
      form.get("CallDuration") ||
      "0";
    const externalEventId = recordingSid
      ? `recording:${recordingSid}:${form.get("RecordingStatus") || "completed"}`
      : `call:${callSid}:${callStatus || "unknown"}:${sequence}`;
    const registration = await registerProviderEvent(
      supabase,
      "twilio",
      externalEventId,
      recordingSid ? "recording.status" : `call.${callStatus || "unknown"}`,
      await sha256Hex(rawBody),
      tenantId,
    );
    if (registration.duplicate) return new Response("OK", { status: 200 });

    try {
      await processRecording(supabase, tenantId, callSid, form);
      await processCallLog(supabase, tenantId, callSid, form);
      if (queueId && callStatus) {
        await processQueueStatus(
          supabase,
          tenantId,
          contactId,
          queueId,
          callStatus,
          form,
        );
      }

      await markProviderEventProcessed(supabase, registration.id!);
      return new Response("OK", { status: 200 });
    } catch (error) {
      await markProviderEventFailed(
        supabase,
        registration.id!,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  } catch (error) {
    console.error("[twilio-call-status] Processing failed", error);
    return new Response("Error", { status: 500 });
  }
});

async function processRecording(
  supabase: any,
  tenantId: string,
  callSid: string,
  form: URLSearchParams,
) {
  const recordingUrl = form.get("RecordingUrl");
  if (!recordingUrl) return;

  const { error } = await supabase
    .from("call_logs")
    .update({ recording_url: `${recordingUrl}.mp3` })
    .eq("tenant_id", tenantId)
    .eq("twilio_call_sid", callSid);
  if (error) throw error;
}

async function processCallLog(
  supabase: any,
  tenantId: string,
  callSid: string,
  form: URLSearchParams,
) {
  const duration = Number(form.get("CallDuration"));
  const updates: Record<string, unknown> = {};
  if (Number.isFinite(duration) && duration >= 0) updates.connected_seconds = duration;
  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase
    .from("call_logs")
    .update(updates)
    .eq("tenant_id", tenantId)
    .eq("twilio_call_sid", callSid);
  if (error) throw error;
}

async function processQueueStatus(
  supabase: any,
  tenantId: string,
  contactId: string | null,
  queueId: string,
  callStatus: string,
  form: URLSearchParams,
) {
  const { data: queue, error: queueError } = await supabase
    .from("call_queue")
    .select("attempt_count,max_attempts,callback_time")
    .eq("tenant_id", tenantId)
    .eq("id", queueId)
    .single();
  if (queueError) throw queueError;

  const now = new Date();
  const baseUpdate: Record<string, unknown> = {
    last_attempt_at: now.toISOString(),
    last_voice_outcome: callStatus,
    locked_at: null,
    worker_id: null,
    updated_at: now.toISOString(),
  };

  if (["initiated", "queued", "ringing", "in-progress", "answered"].includes(callStatus)) {
    const { error } = await supabase
      .from("call_queue")
      .update({ ...baseUpdate, status: "calling" })
      .eq("tenant_id", tenantId)
      .eq("id", queueId);
    if (error) throw error;
    return;
  }

  if (callStatus === "completed") {
    const duration = Number(form.get("CallDuration") || 0);
    const { error } = await supabase
      .from("call_queue")
      .update({
        ...baseUpdate,
        status: "completed",
        notes: `Chiamata completata, durata: ${Number.isFinite(duration) ? duration : 0}s`,
        last_error_code: null,
      })
      .eq("tenant_id", tenantId)
      .eq("id", queueId);
    if (error) throw error;
    return;
  }

  if (!["busy", "no-answer", "failed", "canceled"].includes(callStatus)) return;

  const { data: settings, error: settingsError } = await supabase
    .from("settings")
    .select("retry_config_json,whatsapp_enabled")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (settingsError) throw settingsError;

  const retryConfig = settings?.retry_config_json ?? {};
  const attempts = Number(queue.attempt_count ?? 0);
  const maxAttempts = Number(queue.max_attempts ?? retryConfig.max_attempts ?? 5);
  const callbackTime = queue.callback_time ? new Date(queue.callback_time) : null;

  if (attempts >= maxAttempts) {
    const { error } = await supabase
      .from("call_queue")
      .update({
        ...baseUpdate,
        status: "failed",
        notes: `Raggiunto limite tentativi (${attempts}/${maxAttempts})`,
        last_error_code: callStatus,
      })
      .eq("tenant_id", tenantId)
      .eq("id", queueId);
    if (error) throw error;
    if (contactId) await moveContactToStageType(supabase, tenantId, contactId, "closed_lost");
    return;
  }

  const retryHours = Number(retryConfig.retry_after_hours ?? 4);
  const nextAttempt = callbackTime && callbackTime > now
    ? callbackTime
    : new Date(now.getTime() + Math.max(1, retryHours) * 60 * 60 * 1000);

  const { error: updateError } = await supabase
    .from("call_queue")
    .update({
      ...baseUpdate,
      status: "no_answer",
      next_attempt_at: nextAttempt.toISOString(),
      retry_after: nextAttempt.toISOString(),
      next_action_channel: "voice",
      notes: `Tentativo ${attempts}/${maxAttempts}, prossimo: ${nextAttempt.toISOString()}`,
      last_error_code: callStatus,
    })
    .eq("tenant_id", tenantId)
    .eq("id", queueId);
  if (updateError) throw updateError;

  if (contactId) {
    await moveContactToStageType(supabase, tenantId, contactId, "to_call");
    if (settings?.whatsapp_enabled && retryConfig.send_whatsapp_on_no_answer !== false) {
      await sendMissedCallWhatsApp(supabase, tenantId, contactId);
    }
  }
}

async function sendMissedCallWhatsApp(
  supabase: any,
  tenantId: string,
  contactId: string,
) {
  const [{ data: contact, error: contactError }, { data: template, error: templateError }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("phone_e164,do_not_contact")
        .eq("tenant_id", tenantId)
        .eq("id", contactId)
        .maybeSingle(),
      supabase
        .from("whatsapp_templates")
        .select("template_name")
        .eq("tenant_id", tenantId)
        .eq("template_type", "missed_call")
        .eq("status", "approved")
        .limit(1)
        .maybeSingle(),
    ]);
  if (contactError) throw contactError;
  if (templateError) throw templateError;
  if (!contact?.phone_e164 || contact.do_not_contact || !template?.template_name) return;

  const { data, error } = await supabase.functions.invoke("send-whatsapp", {
    body: {
      tenant_id: tenantId,
      contact_id: contactId,
      to: contact.phone_e164,
      template_name: template.template_name,
    },
  });
  if (error) throw error;
  if (!data?.success) throw new Error("Missed-call WhatsApp was not accepted");

  const { error: queueError } = await supabase
    .from("call_queue")
    .update({
      last_wa_sent_at: new Date().toISOString(),
      last_wa_outcome: "sent",
      wa_available: true,
    })
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .in("status", ["pending", "no_answer"]);
  if (queueError) throw queueError;
}

async function moveContactToStageType(
  supabase: any,
  tenantId: string,
  contactId: string,
  stageType: string,
) {
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
    ? await supabase.from("contact_stages")
      .update({ stage_id: stage.id, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId).eq("id", current.id)
    : await supabase.from("contact_stages").insert({
      tenant_id: tenantId,
      contact_id: contactId,
      stage_id: stage.id,
    });
  if (error) throw error;
}
