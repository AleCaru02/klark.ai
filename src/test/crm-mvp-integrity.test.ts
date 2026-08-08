import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("CRM MVP integrity", () => {
  const crm = read("src/pages/app/CRMSheets.tsx");
  const logs = read("src/pages/app/Logs.tsx");
  const callStatus = read("supabase/functions/twilio-call-status/index.ts");
  const voiceContext = read("supabase/functions/_shared/twilio-voice.ts");
  const booking = read("supabase/functions/ai-book-appointment/index.ts");
  const storageMigration = read("supabase/migrations/20260808210000_voice_audio_storage_hardening.sql");

  it("surfaces DNC and verified callback permission without inventing consent", () => {
    expect(crm).toContain("callback_requested");
    expect(crm).toContain("callback_requested_at");
    expect(crm).toContain("contact_permission_source");
    expect(crm).toContain("Richiamo verificato");
    expect(crm).toContain("Richiamo non verificato");
    expect(crm).toContain("Non contattare (DNC)");
    expect(crm).not.toContain("updates: { callback_requested: true");
  });

  it("scopes CRM mutations explicitly to the current tenant", () => {
    expect(crm).toContain('.eq("tenant_id", tenantId)');
    expect(crm).toContain('.from("contacts")');
    expect(crm).toContain('.from("contact_stages")');
  });

  it("persists call outcome and last contact activity", () => {
    expect(callStatus).toContain('call_status: form.get("CallStatus")');
    expect(callStatus).toContain("duration_seconds");
    expect(callStatus).toContain("last_activity_at: now.toISOString()");
    expect(voiceContext).toContain("last_activity_at: new Date().toISOString()");
    expect(logs).toContain("outcome?.call_status");
    expect(logs).toContain("appointment_booked");
    expect(logs).toContain("human_handoff");
  });

  it("updates the CRM activity timestamp after appointment creation", () => {
    expect(booking).toContain("touchContactActivity");
    expect(booking).toContain("last_activity_at: new Date().toISOString()");
    expect(booking).toContain('"appointment_set"');
  });

  it("keeps voice audio private and served via signed URLs", () => {
    expect(storageMigration).toContain("set public = false");
    expect(storageMigration).toContain('drop policy if exists "Public read access for voice audio"');
    expect(voiceContext).toContain(".createSignedUrl(");
  });
});
