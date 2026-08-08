import {
  constantTimeEqual,
  createServiceClient,
  jsonResponse,
  markProviderEventFailed,
  markProviderEventProcessed,
  registerProviderEvent,
  sha256Hex,
  verifyMetaSignature,
} from "../_shared/security.ts";

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: { body: string };
  type: string;
}

interface WhatsAppStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}

interface WhatsAppValue {
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

interface WhatsAppPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{ field?: string; value?: WhatsAppValue }>;
  }>;
}

interface ContactInfo {
  id: string;
  tenant_id: string;
  do_not_contact: boolean | null;
  name: string;
}

type Command =
  | { type: "STOP" }
  | { type: "ANNULLA" }
  | { type: "CONFERMO" }
  | { type: "CALLBACK"; callbackTime: Date; raw: string }
  | { type: "SPOSTA"; raw: string }
  | { type: null };

Deno.serve(async (request) => {
  const url = new URL(request.url);

  if (request.method === "GET") {
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN")?.trim();
    if (!verifyToken) return new Response("Webhook unavailable", { status: 503 });

    const mode = url.searchParams.get("hub.mode");
    const supplied = url.searchParams.get("hub.verify_token") ?? "";
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    if (mode === "subscribe" && constantTimeEqual(supplied, verifyToken)) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
      });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "GET, POST" });
  }

  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET")?.trim() ||
    Deno.env.get("META_APP_SECRET")?.trim();
  if (!appSecret) return jsonResponse({ error: "Webhook unavailable" }, 503);

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!(await verifyMetaSignature(rawBody, signature, appSecret))) {
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  let payload: WhatsAppPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsAppPayload;
  } catch {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }

  if (payload.object !== "whatsapp_business_account") {
    return jsonResponse({ received: true, ignored: true });
  }

  const supabase = createServiceClient();
  const rawDigest = await sha256Hex(rawBody);

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages" || !change.value) continue;
        const phoneNumberId = change.value.metadata?.phone_number_id;
        if (!phoneNumberId) throw new Error("WhatsApp phone_number_id is missing");

        const { data: integration, error: integrationError } = await supabase
          .from("whatsapp_integrations")
          .select("tenant_id")
          .eq("phone_number_id", phoneNumberId)
          .maybeSingle();
        if (integrationError) throw integrationError;
        if (!integration?.tenant_id) throw new Error("Unknown WhatsApp phone_number_id");
        const tenantId = integration.tenant_id as string;

        const { error: rawEventError } = await supabase.from("whatsapp_events").insert({
          tenant_id: tenantId,
          payload_json: change,
          received_at: new Date().toISOString(),
        });
        if (rawEventError) console.error("Unable to persist raw WhatsApp event", rawEventError);

        for (const message of change.value.messages ?? []) {
          await processIncomingMessage(
            supabase,
            tenantId,
            message,
            rawDigest,
          );
        }

        for (const status of change.value.statuses ?? []) {
          await processMessageStatus(
            supabase,
            tenantId,
            status,
            rawDigest,
          );
        }
      }
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error("[whatsapp-webhook] Processing failed", error);
    return jsonResponse({ error: "Webhook processing failed" }, 500);
  }
});

async function processIncomingMessage(
  supabase: any,
  tenantId: string,
  message: WhatsAppMessage,
  rawDigest: string,
) {
  const registration = await registerProviderEvent(
    supabase,
    "whatsapp",
    message.id,
    `message.${message.type}`,
    rawDigest,
    tenantId,
  );
  if (registration.duplicate) return;

  try {
    const phoneE164 = normalizePhoneE164(message.from);
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id,tenant_id,do_not_contact,name")
      .eq("tenant_id", tenantId)
      .eq("phone_e164", phoneE164)
      .maybeSingle();
    if (contactError) throw contactError;

    const text = message.text?.body?.trim() || null;
    const timestamp = providerTimestamp(message.timestamp);
    const { error: messageError } = await supabase.from("whatsapp_messages").insert({
      tenant_id: tenantId,
      wa_from: message.from,
      message_id: message.id,
      text,
      ts: timestamp,
      contact_id: contact?.id || null,
      direction: "in",
      message_type: message.type,
      delivery_status: "received",
    });
    if (messageError?.code !== "23505" && messageError) throw messageError;

    if (contact) {
      const command = parseCommand(text);
      if (command.type) {
        await handleCommand(supabase, contact as ContactInfo, command, message.id);
      }

      const { error: queueError } = await supabase
        .from("call_queue")
        .update({
          wa_available: true,
          last_wa_outcome: command.type
            ? `command_${command.type.toLowerCase()}`
            : "message_received",
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("contact_id", contact.id)
        .in("status", ["pending", "no_answer", "processing"]);
      if (queueError) throw queueError;

      const { error: activityError } = await supabase
        .from("contacts")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("id", contact.id);
      if (activityError) throw activityError;
    }

    await markProviderEventProcessed(supabase, registration.id!);
  } catch (error) {
    await markProviderEventFailed(
      supabase,
      registration.id!,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

async function processMessageStatus(
  supabase: any,
  tenantId: string,
  status: WhatsAppStatus,
  rawDigest: string,
) {
  const externalEventId = `${status.id}:${status.status}:${status.timestamp}`;
  const registration = await registerProviderEvent(
    supabase,
    "whatsapp",
    externalEventId,
    `status.${status.status}`,
    rawDigest,
    tenantId,
  );
  if (registration.duplicate) return;

  try {
    const { error } = await supabase.from("whatsapp_message_statuses").insert({
      tenant_id: tenantId,
      message_id: status.id,
      status: status.status,
      recipient_id: status.recipient_id,
      ts: providerTimestamp(status.timestamp),
      error_code: status.errors?.[0]?.code || null,
      error_title: status.errors?.[0]?.title || null,
    });
    if (error?.code !== "23505" && error) throw error;

    const { error: updateError } = await supabase
      .from("whatsapp_messages")
      .update({ delivery_status: status.status })
      .eq("tenant_id", tenantId)
      .eq("message_id", status.id);
    if (updateError) throw updateError;

    await markProviderEventProcessed(supabase, registration.id!);
  } catch (error) {
    await markProviderEventFailed(
      supabase,
      registration.id!,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

function parseCommand(text: string | null): Command {
  if (!text) return { type: null };
  const normalized = text.trim();
  if (/^STOP$/i.test(normalized)) return { type: "STOP" };
  if (/^ANNULLA$/i.test(normalized)) return { type: "ANNULLA" };
  if (/^(CONFERMO|OK)$/i.test(normalized)) return { type: "CONFERMO" };
  if (/^SPOSTA\s+.+/i.test(normalized)) return { type: "SPOSTA", raw: normalized };

  const callback = normalized.match(
    /richiam\w*\s+(domani\s+)?(?:alle?\s+)?(\d{1,2})?(?::(\d{2}))?/i,
  );
  if (callback) {
    const now = new Date();
    const callbackTime = new Date(now);
    if (callback[1]) callbackTime.setDate(callbackTime.getDate() + 1);
    callbackTime.setHours(Number(callback[2] || 9), Number(callback[3] || 0), 0, 0);
    if (callbackTime <= now) callbackTime.setDate(callbackTime.getDate() + 1);
    return { type: "CALLBACK", callbackTime, raw: normalized };
  }

  return { type: null };
}

async function handleCommand(
  supabase: any,
  contact: ContactInfo,
  command: Exclude<Command, { type: null }>,
  messageId: string,
) {
  const now = new Date().toISOString();

  if (command.type === "STOP") {
    const { error: contactError } = await supabase
      .from("contacts")
      .update({ do_not_contact: true, updated_at: now })
      .eq("tenant_id", contact.tenant_id)
      .eq("id", contact.id);
    if (contactError) throw contactError;

    const { error: queueError } = await supabase
      .from("call_queue")
      .update({
        status: "failed",
        notes: "Contatto ha inviato STOP via WhatsApp",
        locked_at: null,
        worker_id: null,
        last_error_code: "whatsapp_opt_out",
      })
      .eq("tenant_id", contact.tenant_id)
      .eq("contact_id", contact.id)
      .in("status", ["pending", "no_answer", "processing"]);
    if (queueError) throw queueError;

    await writeAudit(supabase, contact, "whatsapp_command_stop", messageId);
    return;
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id,title,start_at,end_at,meet_link,location,meeting_type")
    .eq("tenant_id", contact.tenant_id)
    .eq("contact_id", contact.id)
    .in("status", ["scheduled", "confirmed", "rescheduled"])
    .gt("start_at", now)
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (appointmentError) throw appointmentError;

  if (command.type === "ANNULLA") {
    if (!appointment) return;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "canceled", updated_at: now })
      .eq("tenant_id", contact.tenant_id)
      .eq("id", appointment.id);
    if (error) throw error;
    await skipAppointmentReminders(supabase, contact.tenant_id, appointment.id, "Canceled via WhatsApp");
    await moveContactToStageType(supabase, contact.tenant_id, contact.id, "to_call");
    await writeAudit(supabase, contact, "whatsapp_command_annulla", messageId, {
      appointment_id: appointment.id,
    });
    return;
  }

  if (command.type === "CONFERMO") {
    if (!appointment) return;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "confirmed", updated_at: now })
      .eq("tenant_id", contact.tenant_id)
      .eq("id", appointment.id);
    if (error) throw error;
    await writeAudit(supabase, contact, "whatsapp_command_confermo", messageId, {
      appointment_id: appointment.id,
    });
    return;
  }

  if (command.type === "CALLBACK") {
    const { data: existing, error: existingError } = await supabase
      .from("call_queue")
      .select("id")
      .eq("tenant_id", contact.tenant_id)
      .eq("contact_id", contact.id)
      .in("status", ["pending", "no_answer", "processing"])
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    const queuePayload = {
      callback_time: command.callbackTime.toISOString(),
      callback_source: "whatsapp",
      next_attempt_at: command.callbackTime.toISOString(),
      retry_after: command.callbackTime.toISOString(),
      next_action_channel: "voice",
      last_wa_outcome: "callback_requested",
      status: "pending",
      locked_at: null,
      worker_id: null,
      notes: `Richiamata richiesta via WhatsApp: ${command.raw}`,
    };
    const { error } = existing
      ? await supabase.from("call_queue").update(queuePayload)
        .eq("tenant_id", contact.tenant_id).eq("id", existing.id)
      : await supabase.from("call_queue").insert({
        tenant_id: contact.tenant_id,
        contact_id: contact.id,
        priority: 5,
        ...queuePayload,
      });
    if (error) throw error;

    await moveContactToStageType(supabase, contact.tenant_id, contact.id, "callback_scheduled");
    await writeAudit(supabase, contact, "whatsapp_callback_scheduled", messageId, {
      callback_time: command.callbackTime.toISOString(),
    });
    return;
  }

  if (command.type === "SPOSTA") {
    if (!appointment) return;
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("timezone")
      .eq("tenant_id", contact.tenant_id)
      .maybeSingle();
    if (settingsError) throw settingsError;
    const timezone = settings?.timezone || "Europe/Rome";
    const newStart = parseRescheduleRequest(command.raw, timezone);
    if (!newStart) {
      await writeAudit(supabase, contact, "whatsapp_command_sposta", messageId, {
        appointment_id: appointment.id,
        requested_date: command.raw,
        status: "pending_manual_review",
      });
      return;
    }

    const oldStart = new Date(appointment.start_at);
    const oldEnd = new Date(appointment.end_at);
    const duration = Math.max(15 * 60 * 1000, oldEnd.getTime() - oldStart.getTime());
    const newEnd = new Date(newStart.getTime() + duration);
    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        start_at: newStart.toISOString(),
        end_at: newEnd.toISOString(),
        status: "rescheduled",
        updated_at: now,
      })
      .eq("tenant_id", contact.tenant_id)
      .eq("id", appointment.id);
    if (updateError) throw updateError;

    await skipAppointmentReminders(supabase, contact.tenant_id, appointment.id, "Rescheduled via WhatsApp");
    const reminderAt = new Date(newStart.getTime() - 24 * 60 * 60 * 1000);
    if (reminderAt > new Date()) {
      const { error: reminderError } = await supabase.from("reminders").insert({
        tenant_id: contact.tenant_id,
        contact_id: contact.id,
        appointment_id: appointment.id,
        channel: "whatsapp",
        reminder_type: "reminder_24h",
        when_ts: reminderAt.toISOString(),
        status: "pending",
        payload_json: {
          start_at: newStart.toISOString(),
          meet_link: appointment.meet_link,
          location: appointment.location,
          meeting_type: appointment.meeting_type,
        },
      });
      if (reminderError?.code !== "23505" && reminderError) throw reminderError;
    }

    await writeAudit(supabase, contact, "whatsapp_command_sposta", messageId, {
      appointment_id: appointment.id,
      old_start_at: appointment.start_at,
      new_start_at: newStart.toISOString(),
      status: "completed",
    });

    const formatted = formatDateTime(newStart, timezone);
    const { error: sendError } = await supabase.functions.invoke("send-whatsapp", {
      body: {
        tenant_id: contact.tenant_id,
        contact_id: contact.id,
        to: null,
        template_name: "appointment_rescheduled",
        parameters: [contact.name, formatted.date, formatted.time],
      },
    });
    if (sendError) console.error("Unable to send reschedule confirmation", sendError);
  }
}

async function skipAppointmentReminders(
  supabase: any,
  tenantId: string,
  appointmentId: string,
  reason: string,
) {
  const { error } = await supabase
    .from("reminders")
    .update({ status: "skipped", error_message: reason, locked_at: null, worker_id: null })
    .eq("tenant_id", tenantId)
    .eq("appointment_id", appointmentId)
    .in("status", ["pending", "processing"]);
  if (error) throw error;
}

async function moveContactToStageType(
  supabase: any,
  tenantId: string,
  contactId: string,
  stageType: string,
) {
  const { data: stage, error: stageError } = await supabase
    .from("stages")
    .select("id,pipeline_id!inner(tenant_id)")
    .eq("tenant_id", tenantId)
    .eq("stage_type", stageType)
    .eq("is_active", true)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (stageError) throw stageError;
  if (!stage) return;

  const { data: existing, error: existingError } = await supabase
    .from("contact_stages")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .maybeSingle();
  if (existingError) throw existingError;

  const { error } = existing
    ? await supabase.from("contact_stages")
      .update({ stage_id: stage.id, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId).eq("id", existing.id)
    : await supabase.from("contact_stages").insert({
      tenant_id: tenantId,
      contact_id: contactId,
      stage_id: stage.id,
    });
  if (error) throw error;
}

async function writeAudit(
  supabase: any,
  contact: ContactInfo,
  action: string,
  messageId: string,
  extra: Record<string, unknown> = {},
) {
  const { error } = await supabase.from("audit_log").insert({
    tenant_id: contact.tenant_id,
    action,
    payload_json: {
      contact_id: contact.id,
      contact_name: contact.name,
      message_id: messageId,
      ...extra,
    },
  });
  if (error) throw error;
}

function normalizePhoneE164(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  return `+${digits}`;
}

function providerTimestamp(value: string): string {
  const seconds = Number(value);
  return Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : new Date().toISOString();
}

function parseRescheduleRequest(raw: string, timezone: string): Date | null {
  const text = raw.replace(/^SPOSTA\s+/i, "").trim();
  const timeMatch = text.match(/(?:alle?\s+|\s)(\d{1,2})(?::(\d{2}))\b/i);
  if (!timeMatch) return null;
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] || 0);
  if (hour > 23 || minute > 59) return null;

  const localNow = localDateParts(new Date(), timezone);
  let year = localNow.year;
  let month = localNow.month;
  let day = localNow.day;

  if (/\bdomani\b/i.test(text)) {
    const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
    year = tomorrow.getUTCFullYear();
    month = tomorrow.getUTCMonth() + 1;
    day = tomorrow.getUTCDate();
  } else {
    const isoMatch = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    const italianMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/);
    if (isoMatch) {
      year = Number(isoMatch[1]);
      month = Number(isoMatch[2]);
      day = Number(isoMatch[3]);
    } else if (italianMatch) {
      day = Number(italianMatch[1]);
      month = Number(italianMatch[2]);
      year = Number(italianMatch[3] || year);
    } else {
      return null;
    }
  }

  const result = zonedLocalToUtc(year, month, day, hour, minute, timezone);
  return result > new Date() ? result : null;
}

function localDateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  let timestamp = Date.UTC(year, month - 1, day, hour, minute);
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(timestamp));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const representedAsUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
    );
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute);
    timestamp += desiredAsUtc - representedAsUtc;
  }
  return new Date(timestamp);
}

function formatDateTime(date: Date, timezone: string) {
  return {
    date: new Intl.DateTimeFormat("it-IT", {
      timeZone: timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(date),
    time: new Intl.DateTimeFormat("it-IT", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date),
  };
}
