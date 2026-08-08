import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("voice human handoff integrity", () => {
  const gather = readFileSync(resolve(process.cwd(), "supabase/functions/twilio-voice-gather/index.ts"), "utf8");
  const onboarding = readFileSync(resolve(process.cwd(), "src/pages/app/Onboarding.tsx"), "utf8");

  it("dials only a preconfigured E.164 handoff destination", () => {
    expect(gather).toContain("handoff_phone_e164");
    expect(gather).toContain("validHandoffPhone");
    expect(gather).toContain("<Dial timeout=\"20\"");
    expect(gather).toContain("<Number>${xmlEscape(handoffPhone)}</Number>");
  });

  it("handles Twilio DialCallStatus and preserves callback fallback", () => {
    expect(gather).toContain("DialCallStatus");
    expect(gather).toContain("human_handoff");
    expect(gather).toContain("human_unavailable");
    expect(gather).toContain("callback_scheduled");
  });

  it("lets onboarding configure but not require a direct-transfer number", () => {
    expect(onboarding).toContain("Numero per trasferimento diretto (opzionale)");
    expect(onboarding).toContain("isValidOptionalE164");
    expect(onboarding).toContain("handoff_phone_e164: handoffPhone.trim()");
  });
});
