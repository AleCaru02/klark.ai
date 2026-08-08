export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(digest));
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

export async function hmacHex(
  algorithm: "SHA-1" | "SHA-256",
  secret: string,
  payload: string,
): Promise<string> {
  const signature = await hmac(algorithm, secret, payload);
  return bytesToHex(signature);
}

export async function hmacBase64(
  algorithm: "SHA-1" | "SHA-256",
  secret: string,
  payload: string,
): Promise<string> {
  return bytesToBase64(await hmac(algorithm, secret, payload));
}

export async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const supplied = signatureHeader.slice("sha256=".length).toLowerCase();
  const expected = await hmacHex("SHA-256", appSecret, rawBody);
  return constantTimeEqual(supplied, expected);
}

export async function verifyTwilioFormSignature(
  requestUrl: string,
  form: URLSearchParams,
  signatureHeader: string | null,
  authToken: string,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const sortedEntries = Array.from(form.entries()).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  let signedPayload = requestUrl;
  for (const [key, value] of sortedEntries) signedPayload += `${key}${value}`;

  const expected = await hmacBase64("SHA-1", authToken, signedPayload);
  return constantTimeEqual(signatureHeader, expected);
}

async function hmac(
  algorithm: "SHA-1" | "SHA-256",
  secret: string,
  payload: string,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
