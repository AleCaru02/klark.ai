export type ServiceIssueSeverity = "P1" | "P2" | "P3";
export type ServiceIssueArea = "voice" | "calendar" | "whatsapp" | "reminder" | "platform";

export interface ServiceIssue {
  id: string;
  severity: ServiceIssueSeverity;
  area: ServiceIssueArea;
  title: string;
  detail: string;
  occurredAt: string;
  sourceId: string;
  actionPath: string;
}

export interface QualityCall {
  id: string;
  connected_seconds: number | null;
  transcript: string | null;
  outcome_json: unknown;
  created_at: string;
}

export interface QualityAppointment {
  id: string;
  status: string | null;
  google_calendar_id: string | null;
  calendar_event_id: string | null;
  created_at: string;
}

export interface QualityMessage {
  id: string;
  status: string | null;
  created_at: string;
}

export interface QualityReminder {
  id: string;
  status: string;
  attempts: number | null;
  last_error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export interface QualityAuditEvent {
  id: string;
  action: string;
  payload_json: unknown;
  created_at: string;
}

function hasOutcome(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length > 0);
}

function safeDetail(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 240);
  return fallback;
}

export function classifyServiceIssues(input: {
  calls: QualityCall[];
  appointments: QualityAppointment[];
  messages: QualityMessage[];
  reminders: QualityReminder[];
  auditEvents: QualityAuditEvent[];
}): ServiceIssue[] {
  const issues: ServiceIssue[] = [];

  for (const call of input.calls) {
    const seconds = Math.max(0, Number(call.connected_seconds ?? 0));
    if (seconds > 0 && seconds < 15) {
      issues.push({
        id: `short-call-${call.id}`,
        severity: "P3",
        area: "voice",
        title: "Chiamata connessa molto breve",
        detail: `Durata registrata: ${seconds} secondi. Verificare audio, apertura e motivo della chiusura.`,
        occurredAt: call.created_at,
        sourceId: call.id,
        actionPath: "/app/logs",
      });
    }
    if (seconds > 0 && !hasOutcome(call.outcome_json)) {
      issues.push({
        id: `missing-outcome-${call.id}`,
        severity: "P3",
        area: "voice",
        title: "Esito chiamata non strutturato",
        detail: "La chiamata risulta connessa ma non contiene un esito strutturato utilizzabile nel report.",
        occurredAt: call.created_at,
        sourceId: call.id,
        actionPath: "/app/logs",
      });
    }
    if (seconds >= 30 && !call.transcript) {
      issues.push({
        id: `missing-transcript-${call.id}`,
        severity: "P3",
        area: "voice",
        title: "Trascrizione non disponibile",
        detail: "La chiamata supera 30 secondi ma non è presente una trascrizione. Verificare consenso e pipeline di trascrizione.",
        occurredAt: call.created_at,
        sourceId: call.id,
        actionPath: "/app/logs",
      });
    }
  }

  for (const appointment of input.appointments) {
    const requiresExternalEvent = Boolean(appointment.google_calendar_id) && appointment.status !== "cancelled";
    if (requiresExternalEvent && !appointment.calendar_event_id) {
      issues.push({
        id: `calendar-${appointment.id}`,
        severity: "P2",
        area: "calendar",
        title: "Evento calendario esterno mancante",
        detail: "L'appuntamento indica un calendario Google ma non contiene l'identificativo dell'evento sincronizzato.",
        occurredAt: appointment.created_at,
        sourceId: appointment.id,
        actionPath: "/app/calendar",
      });
    }
  }

  for (const message of input.messages) {
    if (["failed", "rejected", "undelivered"].includes(String(message.status ?? "").toLowerCase())) {
      issues.push({
        id: `message-${message.id}`,
        severity: "P2",
        area: "whatsapp",
        title: "Messaggio non consegnato",
        detail: `Stato provider: ${message.status}. Verificare autorizzazione, template e destinatario.`,
        occurredAt: message.created_at,
        sourceId: message.id,
        actionPath: "/app/whatsapp",
      });
    }
  }

  for (const reminder of input.reminders) {
    if (reminder.status === "failed" || Number(reminder.attempts ?? 0) >= 3) {
      issues.push({
        id: `reminder-${reminder.id}`,
        severity: Number(reminder.attempts ?? 0) >= 3 ? "P2" : "P3",
        area: "reminder",
        title: "Promemoria non completato",
        detail: safeDetail(reminder.last_error_code ?? reminder.error_message, `Tentativi registrati: ${reminder.attempts ?? 0}.`),
        occurredAt: reminder.created_at,
        sourceId: reminder.id,
        actionPath: "/app/appointments",
      });
    }
  }

  for (const event of input.auditEvents) {
    const action = event.action.toLowerCase();
    if (action.startsWith("service_issue.")) continue;
    if (!/(failed|failure|error|unavailable)/.test(action)) continue;
    const severity: ServiceIssueSeverity = /(webhook|security|signature|bootstrap)/.test(action) ? "P1" : "P2";
    issues.push({
      id: `audit-${event.id}`,
      severity,
      area: "platform",
      title: severity === "P1" ? "Evento piattaforma critico" : "Errore operativo registrato",
      detail: event.action,
      occurredAt: event.created_at,
      sourceId: event.id,
      actionPath: "/app/integrations",
    });
  }

  const priority: Record<ServiceIssueSeverity, number> = { P1: 0, P2: 1, P3: 2 };
  return issues.sort((a, b) => priority[a.severity] - priority[b.severity] || Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
