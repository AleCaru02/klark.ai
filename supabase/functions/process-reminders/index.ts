import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requireServiceRole,
} from "../_shared/security.ts";

const TEMPLATE_BY_TYPE: Record<string, string> = {
  confirmation: "appointment_confirmation",
  reminder_24h: "appointment_reminder",
  reminder: "appointment_reminder",
  canceled: "appointment_canceled",
  cancellation: "appointment_canceled",
  rescheduled: "appointment_rescheduled",
  reschedule: "appointment_rescheduled",
  missed_call: "missed_call_notification",
  call_attempt: "missed_call_notification",
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
  }

  try {
    requireServiceRole(request);
    const supabase = createServiceClient();
    const workerId = crypto.randomUUID();
    const { data: reminders, error: claimError } = await supabase.rpc(
      "claim_reminder_batch",
      { p_limit: 100, p_worker_id: workerId },
    );
    if (claimError) throw claimError;

    if (!reminders?.length) {
      return jsonResponse({ processed: 0, sent: 0, failed: 0, skipped: 0, results: [] });
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const reminder of reminders as any[]) {
      try {
        const [{ data: contact, error: contactError }, { data: appointment, error: appointmentError }] =
          await Promise.all([
            supabase
              .from("contacts")
              .select("id,name,phone_e164,email,do_not_contact")
              .eq("id", reminder.contact_id)
              .eq("tenant_id", reminder.tenant_id)
              .maybeSingle(),
            reminder.appointment_id
              ? supabase
                .from("appointments")
                .select("id,title,start_at,end_at,meet_link,status,location,meeting_type,lead_id")
                .eq("id", reminder.appointment_id)
                .eq("tenant_id", reminder.tenant_id)
                .maybeSingle()
              : Promise.resolve({ data: null, error: null }),
          ]);
        if (contactError) throw contactError;
        if (appointmentError) throw appointmentError;
        if (!contact) throw new Error("Reminder contact not found in tenant");

        if (["canceled", "cancelled"].includes(appointment?.status)) {
          await finishReminder(supabase, reminder, workerId, "skipped", "Appointment canceled");
          results.push({ id: reminder.id, status: "skipped" });
          continue;
        }
        if (contact.do_not_contact) {
          await finishReminder(supabase, reminder, workerId, "skipped", "Contact opted out");
          results.push({ id: reminder.id, status: "skipped" });
          continue;
        }
        if (reminder.reminder_type === "confirmation") {
          await finishReminder(supabase, reminder, workerId, "skipped", "Confirmation is sent at booking time");
          results.push({ id: reminder.id, status: "skipped" });
          continue;
        }

        if (reminder.channel !== "whatsapp") {
          await retryReminder(
            supabase,
            reminder,
            workerId,
            `${reminder.channel || "unknown"}_channel_not_configured`,
          );
          results.push({
            id: reminder.id,
            status: "pending",
            error: "Channel not configured",
          });
          continue;
        }
        if (!contact.phone_e164) throw new Error("Contact has no phone number");

        const { data: tenantSettings, error: settingsError } = await supabase
          .from("settings")
          .select("timezone")
          .eq("tenant_id", reminder.tenant_id)
          .maybeSingle();
        if (settingsError) throw settingsError;
        const timezone = tenantSettings?.timezone || "Europe/Rome";

        const { data: approvedTemplate, error: templateError } = await supabase
          .from("whatsapp_templates")
          .select("template_name")
          .eq("tenant_id", reminder.tenant_id)
          .eq("template_type", reminder.reminder_type)
          .eq("status", "approved")
          .limit(1)
          .maybeSingle();
        if (templateError) throw templateError;

        const templateName = approvedTemplate?.template_name ||
          TEMPLATE_BY_TYPE[reminder.reminder_type];
        if (!templateName) throw new Error("No WhatsApp template configured for reminder type");

        const parameters = buildTemplateParameters(
          reminder.reminder_type,
          reminder.payload_json ?? {},
          contact,
          appointment,
          timezone,
        );
        const { data: sendResult, error: sendError } = await supabase.functions.invoke(
          "send-whatsapp",
          {
            body: {
              tenant_id: reminder.tenant_id,
              contact_id: reminder.contact_id,
              to: contact.phone_e164,
              template_name: templateName,
              language: "it",
              parameters,
            },
          },
        );
        if (sendError) throw sendError;
        if (!sendResult?.success || !sendResult?.message_id) {
          throw new Error("WhatsApp provider did not confirm delivery acceptance");
        }

        const { error: messageError } = await supabase.from("whatsapp_messages").insert({
          tenant_id: reminder.tenant_id,
          contact_id: reminder.contact_id,
          lead_id: appointment?.lead_id || null,
          appointment_id: reminder.appointment_id || null,
          wa_from: "system",
          text: `Template: ${templateName}`,
          direction: "out",
          message_type: reminder.reminder_type,
          delivery_status: "sent",
          message_id: sendResult.message_id,
          ts: new Date().toISOString(),
        });
        if (messageError?.code !== "23505" && messageError) throw messageError;

        await finishReminder(supabase, reminder, workerId, "sent", null, {
          sent_at: new Date().toISOString(),
        });
        results.push({ id: reminder.id, status: "sent" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[process-reminders] Reminder ${reminder.id} failed`, error);
        const finalStatus = await retryReminder(supabase, reminder, workerId, message);
        results.push({ id: reminder.id, status: finalStatus, error: message });
      }
    }

    return jsonResponse({
      processed: results.length,
      sent: results.filter((result) => result.status === "sent").length,
      failed: results.filter((result) => result.status === "failed").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      results,
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    console.error("[process-reminders] Worker failed", error);
    return jsonResponse(
      { error: status === 401 ? "Unauthorized" : "Reminder processing failed" },
      status,
    );
  }
});

async function finishReminder(
  supabase: any,
  reminder: any,
  workerId: string,
  status: string,
  errorMessage: string | null,
  extra: Record<string, unknown> = {},
) {
  const { error } = await supabase
    .from("reminders")
    .update({
      status,
      error_message: errorMessage,
      last_error_code: errorMessage?.slice(0, 250) || null,
      locked_at: null,
      worker_id: null,
      ...extra,
    })
    .eq("id", reminder.id)
    .eq("tenant_id", reminder.tenant_id)
    .eq("worker_id", workerId);
  if (error) throw error;
}

async function retryReminder(
  supabase: any,
  reminder: any,
  workerId: string,
  message: string,
): Promise<"pending" | "failed"> {
  const attempts = Number(reminder.attempts ?? 1);
  if (attempts >= 5) {
    await finishReminder(supabase, reminder, workerId, "failed", message);
    return "failed";
  }

  const retryMinutes = Math.min(240, 15 * 2 ** Math.max(0, attempts - 1));
  const { error } = await supabase
    .from("reminders")
    .update({
      status: "pending",
      when_ts: new Date(Date.now() + retryMinutes * 60 * 1000).toISOString(),
      error_message: message,
      last_error_code: message.slice(0, 250),
      locked_at: null,
      worker_id: null,
    })
    .eq("id", reminder.id)
    .eq("tenant_id", reminder.tenant_id)
    .eq("worker_id", workerId);
  if (error) throw error;
  return "pending";
}

function buildTemplateParameters(
  reminderType: string,
  payload: Record<string, unknown>,
  contact: any,
  appointment: any,
  timezone: string,
): string[] {
  const parameters = [String(contact.name || "Cliente")];
  const startAt = typeof payload.start_at === "string"
    ? payload.start_at
    : appointment?.start_at;
  const formatted = startAt ? formatDateTime(startAt, timezone) : null;

  if (["reminder_24h", "reminder", "confirmation"].includes(reminderType)) {
    if (formatted) parameters.push(formatted.date, formatted.time);
    const destination = typeof payload.meet_link === "string"
      ? payload.meet_link
      : appointment?.meet_link || appointment?.location;
    if (destination) parameters.push(String(destination));
  } else if (["canceled", "cancellation"].includes(reminderType)) {
    if (formatted) parameters.push(formatted.date);
  } else if (["rescheduled", "reschedule"].includes(reminderType)) {
    if (formatted) parameters.push(formatted.date);
    if (payload.new_date) parameters.push(String(payload.new_date));
    if (payload.new_time) parameters.push(String(payload.new_time));
  }

  return parameters;
}

function formatDateTime(iso: string, timezone: string) {
  const date = new Date(iso);
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
