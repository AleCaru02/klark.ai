import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getExpectedTwilioSignature } from "npm:twilio@6.0.2/lib/webhooks/webhooks.js";
import { verifyTwilioFormSignature } from "./crypto.ts";

const authToken = "test_auth_token_not_a_real_secret";
const url = "https://example.supabase.co/functions/v1/twilio-voice-webhook?tenant=pilot";
const form = new URLSearchParams({
  CallSid: "CA11111111111111111111111111111111",
  Direction: "inbound",
  From: "+393331234567",
  To: "+390212345678",
});
const params = Object.fromEntries(form.entries());

denoTest("Twilio form signature accepts the exact public URL and form body", async () => {
  const signature = getExpectedTwilioSignature(authToken, url, params);
  assertEquals(await verifyTwilioFormSignature(url, form, signature, authToken), true);
});

denoTest("Twilio form signature rejects a modified query string", async () => {
  const signature = getExpectedTwilioSignature(authToken, url, params);
  assertEquals(
    await verifyTwilioFormSignature(`${url}&tampered=true`, form, signature, authToken),
    false,
  );
});

denoTest("Twilio form signature rejects a modified form body", async () => {
  const signature = getExpectedTwilioSignature(authToken, url, params);
  const tampered = new URLSearchParams(form);
  tampered.set("From", "+393339999999");
  assertEquals(await verifyTwilioFormSignature(url, tampered, signature, authToken), false);
});

denoTest("Twilio form signature rejects missing and invalid signatures", async () => {
  assertEquals(await verifyTwilioFormSignature(url, form, null, authToken), false);
  assertEquals(await verifyTwilioFormSignature(url, form, "invalid-signature", authToken), false);
  assertEquals(await verifyTwilioFormSignature(url, form, "anything", ""), false);
});

function denoTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({ name, permissions: "none", fn });
}
