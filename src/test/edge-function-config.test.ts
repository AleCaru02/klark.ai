import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const functionsDirectory = resolve(repositoryRoot, "supabase/functions");
const config = readFileSync(resolve(repositoryRoot, "supabase/config.toml"), "utf8");

const functionNames = readdirSync(functionsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
  .map((entry) => entry.name)
  .sort();

function parseFunctionJwtSettings(source: string): Map<string, boolean> {
  const result = new Map<string, boolean>();
  let currentFunction: string | null = null;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    const sectionMatch = line.match(/^\[functions\.([^\]]+)\]$/);
    if (sectionMatch) { currentFunction = sectionMatch[1]; continue; }
    if (line.startsWith("[") && !sectionMatch) { currentFunction = null; continue; }
    if (!currentFunction) continue;
    const settingMatch = line.match(/^verify_jwt\s*=\s*(true|false)$/);
    if (settingMatch) result.set(currentFunction, settingMatch[1] === "true");
  }
  return result;
}

const jwtSettings = parseFunctionJwtSettings(config);

describe("configurazione Edge Functions", () => {
  it("dichiara verify_jwt in modo esplicito per ogni funzione", () => {
    const missing = functionNames.filter((name) => !jwtSettings.has(name));
    expect(missing, `Funzioni senza verify_jwt esplicito: ${missing.join(", ")}`).toEqual([]);
  });

  it("mantiene pubblici soltanto endpoint con verifica dedicata", () => {
    const publicFunctions = Array.from(jwtSettings.entries()).filter(([, verifyJwt]) => !verifyJwt).map(([name]) => name).sort();
    const approvedPublicFunctions = [
      "bootstrap-admin",
      "calendar-watch",
      "facebook-webhook-tenant",
      "google-auth-callback",
      "meta-leadads-auth-callback",
      "meta-leadads-webhook",
      "public-demo-request",
      "public-voice-demo",
      "site-chat-bootstrap",
      "site-chat-message",
      "stripe-webhook",
      "twilio-call-status",
      "twilio-voice-gather",
      "twilio-voice-webhook",
      "whatsapp-auth-callback",
      "whatsapp-webhook",
    ].sort();
    expect(publicFunctions).toEqual(approvedPublicFunctions);
  });
});
