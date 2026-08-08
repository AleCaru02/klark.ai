import { describe, expect, it } from "vitest";
import { classifyServiceIssues } from "@/lib/serviceQuality";

const now = "2026-08-06T10:00:00.000Z";

describe("classificazione qualità del servizio", () => {
  it("classifica chiamate brevi, assenza esito e trascrizione", () => {
    const issues = classifyServiceIssues({
      calls: [
        { id: "short", connected_seconds: 8, transcript: "test", outcome_json: {}, created_at: now },
        { id: "missing-transcript", connected_seconds: 45, transcript: null, outcome_json: { result: "ok" }, created_at: now },
      ],
      appointments: [],
      messages: [],
      reminders: [],
      auditEvents: [],
    });

    expect(issues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      "short-call-short",
      "missing-outcome-short",
      "missing-transcript-missing-transcript",
    ]));
    expect(issues.every((issue) => issue.severity === "P3")).toBe(true);
  });

  it("classifica errori provider e sicurezza con priorità corretta", () => {
    const issues = classifyServiceIssues({
      calls: [],
      appointments: [
        { id: "appointment", status: "booked", google_calendar_id: "calendar", calendar_event_id: null, created_at: now },
      ],
      messages: [{ id: "message", status: "failed", created_at: now }],
      reminders: [{ id: "reminder", status: "failed", attempts: 3, last_error_code: "provider_timeout", error_message: null, created_at: now }],
      auditEvents: [
        { id: "audit", action: "webhook.signature_failed", payload_json: {}, created_at: now },
      ],
    });

    expect(issues[0].severity).toBe("P1");
    expect(issues[0].id).toBe("audit-audit");
    expect(issues.filter((issue) => issue.severity === "P2")).toHaveLength(3);
  });

  it("ignora gli eventi creati dal ciclo di risoluzione incidenti", () => {
    const issues = classifyServiceIssues({
      calls: [],
      appointments: [],
      messages: [],
      reminders: [],
      auditEvents: [
        { id: "resolved", action: "service_issue.resolved", payload_json: {}, created_at: now },
      ],
    });

    expect(issues).toEqual([]);
  });
});
