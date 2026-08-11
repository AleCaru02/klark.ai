import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPlan } from "@/config/plans";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("site chatbot product entitlements", () => {
  it("keeps the chatbot disabled on Essential and included from Growth", () => {
    expect(getPlan("essential").features.join(" ").toLowerCase()).not.toContain("chatbot per il sito");
    expect(getPlan("growth").features.join(" ").toLowerCase()).toContain("chatbot per il sito");
    expect(getPlan("growth").usage.join(" ")).toContain("1.500");
    expect(getPlan("pro").usage.join(" ")).toContain("5.000");
  });

  it("routes tenant access through a fail-closed runtime guard", () => {
    const app = read("src/App.tsx");
    const guard = read("src/pages/app/SiteChatbotRuntimeGuard.tsx");
    const environment = read(".env.example");
    expect(app).toContain("SiteChatbotRuntimeGuard");
    expect(app).not.toContain('const SiteChatbot = lazy(() => import("./pages/app/SiteChatbot"))');
    expect(guard).toContain('VITE_SITE_CHAT_RUNTIME_VERIFIED === "true"');
    expect(environment).toContain("VITE_SITE_CHAT_RUNTIME_VERIFIED=false");
  });

  it("shares the candidate-safe Supabase functions runtime with the app client", () => {
    const page = read("src/pages/app/SiteChatbot.tsx");
    const client = read("src/integrations/supabase/client.ts");
    expect(page).toContain("supabaseFunctionsBase");
    expect(page).not.toContain("import.meta.env.VITE_SUPABASE_URL");
    expect(client).toContain("export const supabaseFunctionsBase");
    expect(client).toContain("CANDIDATE_SUPABASE_URL");
  });
});

describe("site chatbot public embed security", () => {
  const widget = read("public/clark-chat.js");
  const migration = read("supabase/migrations/20260806222500_site_chatbot_multitenant_security.sql");
  const bootstrap = read("supabase/functions/site-chat-bootstrap/index.ts");
  const messages = read("supabase/functions/site-chat-message/index.ts");

  it("does not expose tenant ids or provider secrets in the embed contract", () => {
    expect(widget).toContain("data-widget-key");
    expect(widget).not.toContain("data-tenant-id");
    expect(widget).not.toContain("service_role");
    expect(widget).not.toContain("OPENAI_API_KEY");
    expect(widget).not.toContain("TWILIO_AUTH_TOKEN");
  });

  it("renders remote text without dynamic innerHTML", () => {
    expect(widget).toContain("textContent");
    expect(widget).not.toContain("innerHTML");
    expect(widget).toContain("rel = \"noopener noreferrer\"");
  });

  it("requires origin allowlisting, signed sessions and rate limits", () => {
    expect(bootstrap).toContain("originAllowed");
    expect(bootstrap).toContain("hashSessionToken");
    expect(messages).toContain("verifySessionToken");
    expect(messages).toContain("rate_limit_per_minute");
    expect(messages).toContain("monthly_message_limit");
  });

  it("keeps public tables inaccessible to anonymous database clients", () => {
    expect(migration).toContain("alter table public.site_chatbots enable row level security");
    expect(migration).toContain("alter table public.site_chat_sessions enable row level security");
    expect(migration).toContain("alter table public.site_chat_messages enable row level security");
    expect(migration).toContain("revoke all on public.site_chatbots from anon");
    expect(migration).toContain("revoke all on public.site_chat_sessions from anon");
    expect(migration).toContain("revoke all on public.site_chat_messages from anon");
  });

  it("uses only approved knowledge and blocks prompt-extraction attempts", () => {
    expect(messages).toContain("knowledge.source_approved");
    expect(messages).toContain("knowledge.source_revoked");
    expect(messages).toContain("knowledge.source_expired");
    expect(messages).toContain("Non posso mostrare istruzioni interne");
  });
});
