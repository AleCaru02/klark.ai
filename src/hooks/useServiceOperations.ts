import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  classifyServiceIssues,
  type QualityAppointment,
  type QualityAuditEvent,
  type QualityCall,
  type QualityMessage,
  type QualityReminder,
  type ServiceIssue,
} from "@/lib/serviceQuality";

export interface OperationsLead {
  id: string;
  name: string;
  status: string;
  priority_score: number | null;
  handoff_status: string | null;
  form_payload: unknown;
  notes: string | null;
  last_contact_at: string | null;
  next_action_at: string | null;
  appointment_id: string | null;
  created_at: string;
}

export interface OperationsInteraction {
  id: string;
  lead_id: string;
  direction: string;
  outcome: string | null;
  created_at: string;
}

export interface AppointmentHistoryRow {
  id: string;
  old_appointment_id: string | null;
  new_appointment_id: string | null;
  created_at: string;
}

export interface ServiceOperationsSnapshot {
  periodStart: string;
  calls: QualityCall[];
  appointments: QualityAppointment[];
  appointmentHistory: AppointmentHistoryRow[];
  messages: QualityMessage[];
  reminders: QualityReminder[];
  auditEvents: QualityAuditEvent[];
  leads: OperationsLead[];
  interactions: OperationsInteraction[];
}

export interface ServiceValueMetrics {
  requestsReceived: number;
  closedWorkflows: number;
  callsTracked: number;
  connectedCalls: number;
  structuredOutcomes: number;
  appointmentsCreated: number;
  appointmentsCancelled: number;
  appointmentsRescheduled: number;
  messagesTracked: number;
  humanHandoffs: number;
  activeFollowups: number;
  providerFailures: number;
  recordedInterventions: number;
  connectionRate: number | null;
  structuredOutcomeRate: number | null;
  humanHandoffRate: number | null;
  averageFirstResponseMinutes: number | null;
}

function nonEmptyObject(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length > 0);
}

function issueIdFromPayload(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const issueId = (value as Record<string, unknown>).issue_id;
  return typeof issueId === "string" ? issueId : null;
}

function averageFirstResponseMinutes(
  leads: OperationsLead[],
  interactions: OperationsInteraction[],
): number | null {
  const byLead = new Map<string, number[]>();
  for (const interaction of interactions) {
    if (interaction.direction !== "out") continue;
    const timestamp = Date.parse(interaction.created_at);
    if (!Number.isFinite(timestamp)) continue;
    const items = byLead.get(interaction.lead_id) ?? [];
    items.push(timestamp);
    byLead.set(interaction.lead_id, items);
  }

  const samples: number[] = [];
  for (const lead of leads) {
    const createdAt = Date.parse(lead.created_at);
    const first = (byLead.get(lead.id) ?? []).sort((a, b) => a - b)[0];
    if (!Number.isFinite(createdAt) || !Number.isFinite(first) || first < createdAt) continue;
    samples.push((first - createdAt) / 60_000);
  }
  if (samples.length === 0) return null;
  return Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
}

export function useServiceOperations(days = 30) {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const [snapshot, setSnapshot] = useState<ServiceOperationsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (!tenantId) {
      setSnapshot(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - Math.max(1, Math.min(days, 365)));
    const periodStart = start.toISOString();

    try {
      const [
        callsResult,
        appointmentsResult,
        appointmentHistoryResult,
        messagesResult,
        remindersResult,
        auditResult,
        leadsResult,
        interactionsResult,
      ] = await Promise.all([
        supabase
          .from("call_logs")
          .select("id,connected_seconds,transcript,outcome_json,created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", periodStart)
          .order("created_at", { ascending: false }),
        supabase
          .from("appointments")
          .select("id,status,google_calendar_id,calendar_event_id,created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", periodStart)
          .order("created_at", { ascending: false }),
        supabase
          .from("appointments_history")
          .select("id,old_appointment_id,new_appointment_id,created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", periodStart)
          .order("created_at", { ascending: false }),
        supabase
          .from("message_logs")
          .select("id,status,created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", periodStart)
          .order("created_at", { ascending: false }),
        supabase
          .from("reminders")
          .select("id,status,created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", periodStart)
          .order("created_at", { ascending: false }),
        supabase
          .from("audit_log")
          .select("id,action,payload_json,created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", periodStart)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("leads")
          .select("id,name,status,priority_score,handoff_status,form_payload,notes,last_contact_at,next_action_at,appointment_id,created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", periodStart)
          .order("created_at", { ascending: false }),
        supabase
          .from("interactions")
          .select("id,lead_id,direction,outcome,created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", periodStart)
          .order("created_at", { ascending: false }),
      ]);

      const firstError = [
        callsResult.error,
        appointmentsResult.error,
        appointmentHistoryResult.error,
        messagesResult.error,
        remindersResult.error,
        auditResult.error,
        leadsResult.error,
        interactionsResult.error,
      ].find(Boolean);
      if (firstError) throw firstError;

      const reminders: QualityReminder[] = (remindersResult.data ?? []).map((row) => ({
        id: row.id,
        status: row.status,
        attempts: null,
        last_error_code: null,
        error_message: null,
        created_at: row.created_at,
      }));

      setSnapshot({
        periodStart,
        calls: (callsResult.data ?? []) as QualityCall[],
        appointments: (appointmentsResult.data ?? []) as QualityAppointment[],
        appointmentHistory: (appointmentHistoryResult.data ?? []) as AppointmentHistoryRow[],
        messages: (messagesResult.data ?? []) as QualityMessage[],
        reminders,
        auditEvents: (auditResult.data ?? []) as QualityAuditEvent[],
        leads: (leadsResult.data ?? []) as OperationsLead[],
        interactions: (interactionsResult.data ?? []) as OperationsInteraction[],
      });
    } catch {
      console.error("Unable to load service operations snapshot");
      setError("I dati operativi non sono disponibili. Controlla la connessione e riprova.");
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [days, tenantId]);

  useEffect(() => {
    void fetchSnapshot();
  }, [fetchSnapshot]);

  const allIssues: ServiceIssue[] = useMemo(() => {
    if (!snapshot) return [];
    return classifyServiceIssues({
      calls: snapshot.calls,
      appointments: snapshot.appointments,
      messages: snapshot.messages,
      reminders: snapshot.reminders,
      auditEvents: snapshot.auditEvents,
    });
  }, [snapshot]);

  const resolvedIssueIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of snapshot?.auditEvents ?? []) {
      if (event.action !== "service_issue.resolved") continue;
      const id = issueIdFromPayload(event.payload_json);
      if (id) ids.add(id);
    }
    return ids;
  }, [snapshot]);

  const issues = useMemo(
    () => allIssues.filter((issue) => !resolvedIssueIds.has(issue.id)),
    [allIssues, resolvedIssueIds],
  );

  const metrics: ServiceValueMetrics = useMemo(() => {
    const calls = snapshot?.calls ?? [];
    const leads = snapshot?.leads ?? [];
    const appointments = snapshot?.appointments ?? [];
    const connectedCalls = calls.filter((call) => Number(call.connected_seconds ?? 0) > 0).length;
    const structuredOutcomes = calls.filter((call) => nonEmptyObject(call.outcome_json)).length;
    const providerFailures = issues.filter((issue) => issue.severity === "P1" || issue.severity === "P2").length;
    const humanHandoffs = leads.filter((lead) => lead.handoff_status === "HUMAN").length;
    const terminalStatuses = new Set(["APPOINTMENT_SET", "LOST", "DO_NOT_CONTACT"]);

    return {
      requestsReceived: leads.length,
      closedWorkflows: leads.filter((lead) => terminalStatuses.has(lead.status)).length,
      callsTracked: calls.length,
      connectedCalls,
      structuredOutcomes,
      appointmentsCreated: appointments.length,
      appointmentsCancelled: appointments.filter((appointment) => appointment.status === "cancelled").length,
      appointmentsRescheduled: snapshot?.appointmentHistory.filter((row) => row.old_appointment_id && row.new_appointment_id).length ?? 0,
      messagesTracked: snapshot?.messages.length ?? 0,
      humanHandoffs,
      activeFollowups: leads.filter((lead) => lead.next_action_at && !terminalStatuses.has(lead.status)).length,
      providerFailures,
      recordedInterventions: (snapshot?.auditEvents ?? []).filter((event) => !event.action.startsWith("auth.")).length,
      connectionRate: calls.length > 0 ? Math.round((connectedCalls / calls.length) * 100) : null,
      structuredOutcomeRate: connectedCalls > 0 ? Math.round((structuredOutcomes / connectedCalls) * 100) : null,
      humanHandoffRate: leads.length > 0 ? Math.round((humanHandoffs / leads.length) * 100) : null,
      averageFirstResponseMinutes: averageFirstResponseMinutes(leads, snapshot?.interactions ?? []),
    };
  }, [issues, snapshot]);

  return {
    tenantId,
    snapshot,
    metrics,
    issues,
    allIssues,
    resolvedIssueIds,
    loading,
    error,
    refetch: fetchSnapshot,
  };
}
