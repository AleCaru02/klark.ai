import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const source = read("supabase/functions/public-voice-demo/index.ts");

describe("public ElevenLabs voice demo security", () => {
  it("accepts only predefined clips instead of arbitrary TTS text", () => {
    expect(source).toContain("const clips = {");
    expect(source).toContain("isClipId");
    expect(source).not.toContain("payload.text");
    expect(source).not.toContain("payload.voiceId");
  });

  it("restricts browser origins and keeps the provider key server-side", () => {
    const forbiddenBrowserPrefix = ["VITE", "ELEVENLABS"].join("_");
    expect(source).toContain("allowedOrigins.has(origin)");
    expect(source).toContain('Deno.env.get("ELEVENLABS_API_KEY")');
    expect(source).not.toContain(forbiddenBrowserPrefix);
  });

  it("caches generated audio before returning a short-lived signed URL", () => {
    expect(source).toContain('.from(bucketName)');
    expect(source).toContain('.list(folder');
    expect(source).toContain('.upload(objectPath');
    expect(source).toContain('.createSignedUrl(objectPath, 60 * 15)');
  });
});
