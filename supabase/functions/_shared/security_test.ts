import {
  constantTimeEqual,
  hmacBase64,
  hmacHex,
  sha256Hex,
  verifyMetaSignature,
  verifyTwilioFormSignature,
} from "./crypto.ts";

Deno.test("constantTimeEqual compares exact values", () => {
  assertTrue(constantTimeEqual("same-value", "same-value"));
  assertFalse(constantTimeEqual("same-value", "different-value"));
  assertFalse(constantTimeEqual("short", "shorter"));
});

Deno.test("sha256Hex is deterministic", async () => {
  assertEquals(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

Deno.test("Meta signature is required and verified", async () => {
  const body = '{"event":"test"}';
  const secret = "meta-secret";
  const signature = `sha256=${await hmacHex("SHA-256", secret, body)}`;
  assertTrue(await verifyMetaSignature(body, signature, secret));
  assertFalse(await verifyMetaSignature(body, null, secret));
  assertFalse(await verifyMetaSignature(`${body}x`, signature, secret));
});

Deno.test("Twilio form signature uses exact URL and sorted parameters", async () => {
  const url = "https://example.com/functions/v1/twilio?tenant_id=t1";
  const form = new URLSearchParams({ CallSid: "CA123", CallStatus: "completed" });
  const payload = `${url}CallSidCA123CallStatuscompleted`;
  const signature = await hmacBase64("SHA-1", "twilio-secret", payload);

  assertTrue(
    await verifyTwilioFormSignature(url, form, signature, "twilio-secret"),
  );
  assertFalse(
    await verifyTwilioFormSignature(`${url}&changed=true`, form, signature, "twilio-secret"),
  );
});

function assertTrue(value: unknown): asserts value {
  if (!value) throw new Error(`Expected truthy value, received ${String(value)}`);
}

function assertFalse(value: unknown): void {
  if (value) throw new Error(`Expected falsy value, received ${String(value)}`);
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}
