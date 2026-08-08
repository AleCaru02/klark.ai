import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("MVP Voice hardening", () => {
  const makeCall = read("supabase/functions/twilio-make-call/index.ts");
  const webhook = read("supabase/functions/twilio-voice-webhook/index.ts");
  const gather = read("supabase/functions/twilio-voice-gather/index.ts");
  const status = read("supabase/functions/twilio-call-status/index.ts");
  const shared = read("supabase/functions/_shared/twilio-voice.ts");
  const worker = read("supabase/functions/process-call-queue/index.ts");
  const migration = read("supabase/migrations/20260808183000_voice_test_mode_and_provisioning_gate.sql");

  it("uses tenant subaccount and dedicated Voice number for outbound calls", () => {
    expect(makeCall).toContain("twilio_subaccount_sid");
    expect(makeCall).toContain("Accounts/${subaccountSid}/Calls.json");
    expect(makeCall).toContain("From: phoneNumber.phone_number");
    expect(makeCall).not.toContain("From: settings?.caller_id_e164");
  });

  it("never hard-codes recording for every call", () => {
    expect(makeCall).toContain("const recordingRequested = settings.recording_opt_in === true");
    expect(makeCall).toContain('if (recordingRequested)');
    expect(makeCall).toContain('formData.set("Record", "true")');
    expect(status).toContain("outcome.recording_requested !== true");
    expect(makeCall).not.toMatch(/new URLSearchParams\(\{[\s\S]*Record:\s*["']true["']/);
  });

  it("discloses the virtual assistant in the first Voice greeting", () => {
    expect(webhook).toContain("sono l'assistente virtuale di ${tenantName}");
  });

  it("validates Twilio webhooks with the owning subaccount token", () => {
    expect(shared).toContain("resolveTwilioWebhookAuthToken");
    expect(shared).toContain("twilio_subaccount_sid");
    expect(webhook).toContain("resolveTwilioWebhookAuthToken");
    expect(gather).toContain("resolveTwilioWebhookAuthToken");
    expect(status).toContain("resolveTwilioWebhookAuthToken");
  });

  it("keeps callSid in Voice context so handoff status updates the correct call", () => {
    expect(shared).toContain("callSid: string;");
    expect(gather).toContain('.eq("twilio_call_sid", context.callSid)');
  });

  it("uses OpenAI directly for live Voice reasoning, not Lovable credits", () => {
    expect(gather).toContain("OPENAI_API_KEY");
    expect(gather).toContain("https://api.openai.com/v1/chat/completions");
    expect(gather).not.toContain("LOVABLE_API_KEY");
    expect(gather).not.toContain("ai.gateway.lovable.dev");
  });

  it("keeps automated queue processing out of Voice test mode", () => {
    expect(makeCall).toContain("Test calls cannot use the automated call queue");
    expect(makeCall).toContain("Platform admin required for Voice test mode");
    expect(worker).not.toContain("test_mode: true");
    expect(worker).toContain("callback_requested");
    expect(worker).toContain("do_not_contact");
  });

  it("lets a regulatory-approved pending number be tested but not activated before runtime verification", () => {
    expect(migration).toContain("is_testable_voice_number");
    expect(migration).toContain("p.status in ('pending','active')");
    expect(migration).toContain("Voice number cannot be activated before voice runtime verification");
    expect(migration).toContain("voice_test_mode boolean not null default false");
  });
});
