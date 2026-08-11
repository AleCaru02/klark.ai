import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requireUserTenant,
} from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CrawlRequest {
  tenant_id?: string;
  knowledge_id?: string;
  url?: string;
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);

  const supabase = createServiceClient();
  let tenantId = "";
  let knowledgeId = "";

  try {
    const context = await requireUserTenant(request, supabase);
    tenantId = context.tenantId;
    const body = await request.json().catch(() => ({})) as CrawlRequest;
    knowledgeId = typeof body.knowledge_id === "string" ? body.knowledge_id.trim() : "";
    if (!knowledgeId) throw new AuthError("knowledge_id is required", 400);
    if (body.tenant_id && body.tenant_id !== tenantId) throw new AuthError("Tenant mismatch", 403);

    const formattedUrl = normalizePublicHttpUrl(body.url);
    const { data: source, error: sourceError } = await supabase
      .from("tenant_knowledge")
      .select("id,tenant_id,source_type,source_url")
      .eq("id", knowledgeId)
      .eq("tenant_id", tenantId)
      .eq("source_type", "website")
      .maybeSingle();
    if (sourceError) throw sourceError;
    if (!source) throw new AuthError("Knowledge source not found", 404);

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY")?.trim();
    if (!firecrawlKey) return jsonResponse({ error: "Firecrawl non configurato" }, 503, corsHeaders);

    const { error: processingError } = await supabase
      .from("tenant_knowledge")
      .update({
        source_url: formattedUrl,
        status: "processing",
        error_message: null,
        approved_at: null,
        approval_expires_at: null,
        approved_by: null,
        approval_checksum: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", knowledgeId)
      .eq("tenant_id", tenantId);
    if (processingError) throw processingError;

    const crawlResponse = await fetch("https://api.firecrawl.dev/v1/crawl", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        limit: 50,
        maxDepth: 3,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    });
    const crawlData = await crawlResponse.json().catch(() => ({})) as Record<string, unknown>;

    if (!crawlResponse.ok) {
      const providerError = typeof crawlData.error === "string" ? crawlData.error.slice(0, 500) : "Errore durante il crawl";
      await markFailed(supabase, tenantId, knowledgeId, providerError);
      return jsonResponse({ error: "Crawl failed" }, 502, corsHeaders);
    }

    const crawlId = typeof crawlData.id === "string" ? crawlData.id : null;
    if (crawlId) {
      const task = pollCrawlResults(crawlId, tenantId, knowledgeId, firecrawlKey, supabase);
      const waitUntil = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<void>) => void } }).EdgeRuntime?.waitUntil;
      if (waitUntil) waitUntil(task);
      else void task;
      return jsonResponse({ success: true, status: "processing" }, 202, corsHeaders);
    }

    if (Array.isArray(crawlData.data)) {
      const result = extractPages(crawlData.data);
      await markPendingReview(supabase, tenantId, knowledgeId, result.content, result.count, formattedUrl);
      return jsonResponse({ success: true, status: "pending_review", pages_crawled: result.count }, 200, corsHeaders);
    }

    await markFailed(supabase, tenantId, knowledgeId, "Il provider non ha restituito contenuti utilizzabili");
    return jsonResponse({ error: "Crawl returned no content" }, 502, corsHeaders);
  } catch (error) {
    if (error instanceof AuthError) return jsonResponse({ error: error.message }, error.status, corsHeaders);
    if (tenantId && knowledgeId) await markFailed(supabase, tenantId, knowledgeId, "Errore durante il crawl");
    console.error("[crawl-website] Processing failed");
    return jsonResponse({ error: "Internal server error" }, 500, corsHeaders);
  }
});

function normalizePublicHttpUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new AuthError("URL is required", 400);
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new AuthError("Invalid URL", 400);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new AuthError("Only public HTTP(S) URLs are allowed", 400);
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new AuthError("Private or local hosts are not allowed", 400);
  }
  if (isPrivateIpLiteral(host)) throw new AuthError("Private or local hosts are not allowed", 400);
  url.hash = "";
  return url.toString();
}

function isPrivateIpLiteral(host: string): boolean {
  if (host === "::1" || host === "0:0:0:0:0:0:0:1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((part) => part > 255)) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function extractPages(rows: unknown[]): { content: string; count: number } {
  const pages = rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const markdown = (row as { markdown?: unknown }).markdown;
    return typeof markdown === "string" && markdown.trim() ? [markdown.trim()] : [];
  });
  return { content: pages.join("\n\n---\n\n").slice(0, 500_000), count: pages.length };
}

async function markPendingReview(
  supabase: ReturnType<typeof createServiceClient>,
  tenantId: string,
  knowledgeId: string,
  content: string,
  pageCount: number,
  sourceUrl?: string,
) {
  if (!content) {
    await markFailed(supabase, tenantId, knowledgeId, "Nessun contenuto utile trovato");
    return;
  }
  const { error } = await supabase.from("tenant_knowledge").update({
    source_url: sourceUrl,
    status: "pending_review",
    content_text: content,
    crawled_pages: pageCount,
    content_summary: `Crawlate ${pageCount} pagine. Contenuto in attesa di approvazione.`,
    error_message: null,
    approved_at: null,
    approval_expires_at: null,
    approved_by: null,
    approval_checksum: null,
    updated_at: new Date().toISOString(),
  }).eq("id", knowledgeId).eq("tenant_id", tenantId);
  if (error) throw error;
}

async function markFailed(
  supabase: ReturnType<typeof createServiceClient>,
  tenantId: string,
  knowledgeId: string,
  message: string,
) {
  await supabase.from("tenant_knowledge").update({
    status: "failed",
    error_message: message.slice(0, 1000),
    approved_at: null,
    approval_expires_at: null,
    approved_by: null,
    approval_checksum: null,
    updated_at: new Date().toISOString(),
  }).eq("id", knowledgeId).eq("tenant_id", tenantId);
}

async function pollCrawlResults(
  crawlId: string,
  tenantId: string,
  knowledgeId: string,
  apiKey: string,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      const response = await fetch(`https://api.firecrawl.dev/v1/crawl/${encodeURIComponent(crawlId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (data.status === "completed" && Array.isArray(data.data)) {
        const result = extractPages(data.data);
        await markPendingReview(supabase, tenantId, knowledgeId, result.content, result.count);
        return;
      }
      if (data.status === "failed") {
        await markFailed(supabase, tenantId, knowledgeId, "Crawl fallito dal provider");
        return;
      }
    } catch {
      if (attempt === 60) break;
    }
  }
  await markFailed(supabase, tenantId, knowledgeId, "Timeout durante il crawl");
}
