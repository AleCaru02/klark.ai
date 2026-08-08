import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CrawlRequest {
  tenant_id: string;
  knowledge_id: string;
  url: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseServiceKey) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      if (claimsError || !claims?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Firecrawl non configurato" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenant_id, knowledge_id, url }: CrawlRequest = await req.json();

    console.log(`Starting crawl for tenant ${tenant_id}, knowledge ${knowledge_id}, url: ${url}`);

    // Update status to processing
    await supabase
      .from("tenant_knowledge")
      .update({ status: "processing" })
      .eq("id", knowledge_id);

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Start crawl with Firecrawl
    const crawlResponse = await fetch("https://api.firecrawl.dev/v1/crawl", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        limit: 50,
        maxDepth: 3,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
        },
      }),
    });

    const crawlData = await crawlResponse.json();

    if (!crawlResponse.ok) {
      console.error("Firecrawl crawl error:", crawlData);
      await supabase
        .from("tenant_knowledge")
        .update({ 
          status: "failed", 
          error_message: crawlData.error || "Errore durante il crawl" 
        })
        .eq("id", knowledge_id);

      return new Response(
        JSON.stringify({ error: crawlData.error || "Crawl failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Crawl response:", crawlData);

    if (crawlData.id) {
      const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
      if (waitUntil) {
        waitUntil(pollCrawlResults(
          crawlData.id,
          knowledge_id,
          FIRECRAWL_API_KEY,
          supabase
        ));
      } else {
        pollCrawlResults(crawlData.id, knowledge_id, FIRECRAWL_API_KEY, supabase);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Crawl avviato, elaborazione in corso...",
          crawl_id: crawlData.id 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (crawlData.data) {
      const allContent = crawlData.data
        .map((page: any) => page.markdown || "")
        .filter((content: string) => content.length > 0)
        .join("\n\n---\n\n");

      await supabase
        .from("tenant_knowledge")
        .update({
          status: "completed",
          content_text: allContent.substring(0, 500000),
          crawled_pages: crawlData.data.length,
          content_summary: `Crawlate ${crawlData.data.length} pagine da ${formattedUrl}`,
        })
        .eq("id", knowledge_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          pages_crawled: crawlData.data.length 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Crawl avviato" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Crawl error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function pollCrawlResults(
  crawlId: string,
  knowledgeId: string,
  apiKey: string,
  supabase: any
) {
  const maxAttempts = 60;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
      const response = await fetch(`https://api.firecrawl.dev/v1/crawl/${crawlId}`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      const data = await response.json();
      console.log(`Poll attempt ${attempts} for crawl ${crawlId}:`, data.status);

      if (data.status === "completed" && data.data) {
        const allContent = data.data
          .map((page: any) => page.markdown || "")
          .filter((content: string) => content.length > 0)
          .join("\n\n---\n\n");

        await supabase
          .from("tenant_knowledge")
          .update({
            status: "completed",
            content_text: allContent.substring(0, 500000),
            crawled_pages: data.data.length,
            content_summary: `Crawlate ${data.data.length} pagine`,
          })
          .eq("id", knowledgeId);

        console.log(`Crawl ${crawlId} completed with ${data.data.length} pages`);
        return;
      }

      if (data.status === "failed") {
        await supabase
          .from("tenant_knowledge")
          .update({
            status: "failed",
            error_message: data.error || "Crawl fallito",
          })
          .eq("id", knowledgeId);

        console.error(`Crawl ${crawlId} failed:`, data.error);
        return;
      }
    } catch (error) {
      console.error(`Poll error for crawl ${crawlId}:`, error);
    }
  }

  await supabase
    .from("tenant_knowledge")
    .update({
      status: "failed",
      error_message: "Timeout: il crawl ha impiegato troppo tempo",
    })
    .eq("id", knowledgeId);
}
