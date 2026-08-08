import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("site chatbot provider integrity", () => {
  const messages = read("supabase/functions/site-chat-message/index.ts");
  const widget = read("public/clark-chat.js");

  it("keeps the explicitly enabled public chatbot independent from commercial tenant lifecycle", () => {
    expect(messages).not.toContain("requireActiveTenant(client, chatbot.tenant_id)");
    expect(messages).toContain("loadChatbot(client, widgetKey)");
    expect(messages).toContain("originAllowed(requestOrigin, chatbot.allowed_origins)");
  });

  it("attributes OpenAI usage to the real chatbot tenant", () => {
    expect(messages).toContain("tenantId: chatbot.tenant_id");
    expect(messages).toContain("p_tenant_id: input.tenantId");
    expect(messages).not.toContain("tenantConfiguration as Record<string, unknown>)?.tenant_id");
  });

  it("persists an honest assistant response when OpenAI is unavailable", () => {
    expect(messages).toContain('throw new AiProviderError("missing_api_key")');
    expect(messages).toContain('provider_status: "unavailable"');
    expect(messages).toContain("In questo momento il servizio AI non è disponibile");
    expect(messages).toContain('action: "site_chat.provider_failed"');
    expect(messages).toContain("aiResult.input_tokens");
    expect(messages).toContain("aiResult.output_tokens");
  });

  it("keeps the OpenAI secret server-side only", () => {
    expect(messages).toContain('Deno.env.get("OPENAI_API_KEY")');
    expect(widget).not.toContain("OPENAI_API_KEY");
    expect(widget).not.toContain("VITE_OPENAI");
  });
});
