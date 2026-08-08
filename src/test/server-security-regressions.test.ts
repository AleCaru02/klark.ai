import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "supabase/functions");
const config = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? collectTypeScriptFiles(path)
      : path.endsWith(".ts")
        ? [path]
        : [];
  });
}

function publicFunctionNames(): Set<string> {
  const names = new Set<string>();
  let current: string | null = null;
  for (const rawLine of config.split(/\r?\n/)) {
    const line = rawLine.trim();
    const section = line.match(/^\[functions\.([^\]]+)\]$/);
    if (section) {
      current = section[1];
      continue;
    }
    if (line.startsWith("[") && !section) current = null;
    if (current && /^verify_jwt\s*=\s*false$/.test(line)) names.add(current);
  }
  return names;
}

const publicFunctions = publicFunctionNames();
const sources = collectTypeScriptFiles(root).map((path) => ({ path, source: readFileSync(path, "utf8") }));

describe("regressioni sicurezza Edge Functions", () => {
  it("non consente CORS wildcard sugli endpoint pubblici", () => {
    const offenders = sources
      .filter(({ path, source }) => {
        const functionName = path.split("/functions/")[1]?.split("/")[0];
        return publicFunctions.has(functionName) &&
          /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/.test(source);
      })
      .map(({ path }) => path.replace(process.cwd(), ""));
    expect(offenders).toEqual([]);
  });

  it("non inserisce token provider in URL di query", () => {
    const offenders = sources
      .filter(({ source }) => /https?:[^\n`"']*[?&](token|access_token|refresh_token)=/i.test(source))
      .map(({ path }) => path.replace(process.cwd(), ""));
    expect(offenders).toEqual([]);
  });

  it("non registra direttamente token o chiavi server", () => {
    const offenders = sources
      .filter(({ source }) =>
        /console\.(log|error|warn)\([^\n]*(access_token|refresh_token|serviceRoleKey|STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY)/i.test(source),
      )
      .map(({ path }) => path.replace(process.cwd(), ""));
    expect(offenders).toEqual([]);
  });
});
