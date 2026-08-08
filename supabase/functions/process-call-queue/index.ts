import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requireActiveTenant,
  requireServiceRole,
} from "../_shared/security.ts";

interface AvailabilityWindow {
  start: string;
  end: string;
}

type Availability = Record<string, AvailabilityWindow>;

serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
  }

  try {
    requireServiceRole(request);
    const supabase = createServiceClient();
    const workerId = crypto.randomUUID();

    const { data: queueItems, error: claimError } = await supabase.rpc(
      "claim_call_queue_batch",
      { p_limit: 10, p_worker_id: workerId },
    );
    if (claimError) throw claimError;

    if (!queueItems?.length) {
      return jsonResponse({ processed: 0, successful: 0, results: [] });
    }

    const results: Array<{ queue_id: string; success: boolean; error?: string }> = [];

    for (const item of queueItems as any[]) {
      try {
        try {
          await requireActiveTenant(supabase, item.tenant_id);
        } catch (error) {
          await failQueueItem(
            supabase,
            item,
            "tenant_not_active",
            error instanceof Error ? error.message : "Tenant service is not active",
          );
          results.push({ queue_id: item.id, success: false, error: "Tenant not active" });
          continue;
        }

        if (Number(item.attempt_count ?? 0) >= Number(item.max_attempts ?? 0)) {
          await failQueueItem(supabase, item, "max_attempts_reached", "Raggiunto limite massimo tentativi");
          await moveContactToStageType(
            supabase,
            item.tenant_id,
            item.contact_id,
            "closed_lost",
          );
          results.push({ queue_id: item.id, success: false, error: "Max attempts reached" });
          continue;
        }

        const { data: settings, error: settingsError } = await supabase
          .from("settings")
          .select("voice_enabled,voice_runtime_verified,availability_json,timezone")
          .eq("tenant_id", item.tenant_id)
          .maybeSingle();
        if (settingsError) throw settingsError;

        if (settings?.voice_enabled !== true || settings?.voice_runtime_verified !== true) {
          await cancelQueueItem(
            supabase,
            item,
            "voice_runtime_not_ready",
            "Voice non abilitato o runtime non verificato per il tenant.",
          );
          results.push({ queue_id: item.id, success: false, error: "Voice runtime not ready" });
          continue;
        }

        const { data: phoneNumber, error: phoneError } = await supabase
          .from("tenant_phone_numbers")
          .select("id")
          .eq("tenant_id", item.tenant_id)
          .eq("phone_type", "voice")
          .eq("status", "active")
          .eq("provider_status", "verified")
          .eq("regulatory_status", "approved")
          .not("regulatory_verified_at", "is", null)
          .limit(1)
          .maybeSingle();
        if (phoneError) throw phoneError;
        if (!phoneNumber) {
          await cancelQueueItem(supabase, item, "voice_number_missing", "Nessun numero Voice italiano conforme e attivo per questo tenant.");
          results.push({ queue_id: item.id, success: false, error: "No compliant voice number" });
          continue;
        }

        const { data: contactPermission, error: permissionError } = await supabase
          .from("contacts")
          .select("do_not_contact,callback_requested,callback_requested_at,contact_permission_source")
          .eq("tenant_id", item.tenant_id)
          .eq("id", item.contact_id)
          .maybeSingle();
        if (permissionError) throw permissionError;
        if (!contactPermission) {
          await cancelQueueItem(supabase, item, "contact_missing", "Contatto non trovato nel tenant.");
          results.push({ queue_id: item.id, success: false, error: "Contact missing" });
          continue;
        }
        if (contactPermission.do_not_contact === true) {
          await cancelQueueItem(supabase, item, "do_not_contact", "Contatto escluso: do_not_contact attivo.");
          results.push({ queue_id: item.id, success: false, error: "Do not contact" });
          continue;
        }
        const callbackAllowed = contactPermission.callback_requested === true &&
          Boolean(contactPermission.callback_requested_at) &&
          typeof contactPermission.contact_permission_source === "string" &&
          contactPermission.contact_permission_source.trim().length > 0;
        if (!callbackAllowed) {
          await cancelQueueItem(
            supabase,
            item,
            "contact_permission_missing",
            "Richiesta di ricontatto non verificata: chiamata automatica bloccata.",
          );
          results.push({ queue_id: item.id, success: false, error: "Callback permission missing" });
          continue;
        }

        const availability = settings?.availability_json as Availability | null;
        const timezone = typeof settings?.timezone === "string"
          ? settings.timezone
          : "Europe/Rome";
        if (availability && !isWithinAvailability(availability, timezone, new Date())) {
          const retryAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          const { error: releaseError } = await supabase
            .from("call_queue")
            .update({
              status: "pending",
              next_attempt_at: retryAt,
              retry_after: retryAt,
              locked_at: null,
              worker_id: null,
              last_error_code: "outside_business_hours",
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id)
            .eq("tenant_id", item.tenant_id)
            .eq("worker_id", workerId);
          if (releaseError) throw releaseError;
          results.push({ queue_id: item.id, success: false, error: "Outside business hours" });
          continue;
        }

        const { data: callResult, error: callError } = await supabase.functions.invoke(
          "twilio-make-call",
          {
            body: {
              tenant_id: item.tenant_id,
              contact_id: item.contact_id,
              call_queue_id: item.id,
            },
          },
        );
        if (callError) throw callError;
        if (!callResult?.success) throw new Error("Call provider did not confirm initiation");

        results.push({ queue_id: item.id, success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[process-call-queue] Item ${item.id} failed`, error);
        await scheduleRetry(supabase, item, workerId, message);
        results.push({ queue_id: item.id, success: false, error: message });
      }
    }

    return jsonResponse({
      processed: results.length,
      successful: results.filter((result) => result.success).length,
      results,
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    console.error("[process-call-queue] Worker failed", error);
    return jsonResponse(
      { error: status === 401 ? "Unauthorized" : "Queue processing failed" },
      status,
    );
  }
});

async function scheduleRetry(
  supabase: any,
  item: any,
  workerId: string,
  message: string,
) {
  const attemptCount = Number(item.attempt_count ?? 0);
  const maxAttempts = Number(item.max_attempts ?? 3);

  if (attemptCount >= maxAttempts) {
    await failQueueItem(supabase, item, "max_attempts_reached", message);
    return;
  }

  const delayMinutes = Math.min(60, 5 * Math.max(1, 2 ** attemptCount));
  const retryAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("call_queue")
    .update({
      status: "no_answer",
      next_attempt_at: retryAt,
      retry_after: retryAt,
      locked_at: null,
      worker_id: null,
      last_error_code: message.slice(0, 250),
      notes: `Errore temporaneo: ${message}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id)
    .eq("tenant_id", item.tenant_id)
    .eq("worker_id", workerId);
  if (error) console.error("Unable to schedule queue retry", error);
}

async function cancelQueueItem(
  supabase: any,
  item: any,
  errorCode: string,
  notes: string,
) {
  const { error } = await supabase
    .from("call_queue")
    .update({
      status: "cancelled",
      locked_at: null,
      worker_id: null,
      last_error_code: errorCode,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id)
    .eq("tenant_id", item.tenant_id);
  if (error) throw error;
}

async function failQueueItem(
  supabase: any,
  item: any,
  errorCode: string,
  notes: string,
) {
  const { error } = await supabase
    .from("call_queue")
    .update({
      status: "failed",
      locked_at: null,
      worker_id: null,
      last_error_code: errorCode,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id)
    .eq("tenant_id", item.tenant_id);
  if (error) throw error;
}

async function moveContactToStageType(
  supabase: any,
  tenantId: string,
  contactId: string,
  stageType: string,
) {
  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  if (pipelineError) throw pipelineError;
  if (!pipeline) return;

  const { data: stage, error: stageError } = await supabase
    .from("stages")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("pipeline_id", pipeline.id)
    .eq("stage_type", stageType)
    .eq("is_active", true)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (stageError) throw stageError;
  if (!stage) return;

  const { error: upsertError } = await supabase
    .from("contact_stages")
    .upsert({
      tenant_id: tenantId,
      contact_id: contactId,
      stage_id: stage.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "contact_id" });
  if (upsertError) throw upsertError;

  const { error: contactError } = await supabase
    .from("contacts")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("tenant_id", tenantId);
  if (contactError) throw contactError;
}

function isWithinAvailability(
  availability: Availability,
  timezone: string,
  instant: Date,
): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const weekday = parts.find((part) => part.type === "weekday")?.value.toLowerCase();
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  if (!weekday || !hour || !minute) return false;

  const window = availability[weekday];
  if (!window?.start || !window?.end) return false;
  const current = `${hour}:${minute}`;
  return current >= window.start && current <= window.end;
}
