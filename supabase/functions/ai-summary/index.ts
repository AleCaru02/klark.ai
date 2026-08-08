import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SummaryOutput {
  recap: string;
  key_points: string[];
  objections: string[];
  outcome: string;
  next_steps: string[];
  tags_add: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";

    // --- Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    if (token !== serviceRoleKey) {
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

    const { tenant_id, lead_id, transcript_text } = await req.json();

    if (!tenant_id || !lead_id || !transcript_text) {
      return new Response(
        JSON.stringify({ error: "tenant_id, lead_id, and transcript_text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ai-summary] Processing transcript for lead ${lead_id}`);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Load lead data for context
    const { data: lead } = await supabase
      .from("leads")
      .select("name, source, status, tags")
      .eq("id", lead_id)
      .eq("tenant_id", tenant_id)
      .single();

    const leadContext = lead ? `Lead: ${lead.name}, Fonte: ${lead.source}, Status: ${lead.status}` : "";

    const systemPrompt = `Sei un assistente AI specializzato nell'analisi di trascrizioni di chiamate commerciali.
Analizza la trascrizione e estrai le informazioni chiave in modo strutturato.

RISPONDI SOLO con un JSON valido nel formato richiesto, senza markdown o testo aggiuntivo.`;

    const userPrompt = `${leadContext}

Trascrizione:
${transcript_text}

Analizza e rispondi SOLO con JSON nel formato:
{
  "recap": "Riassunto della conversazione in 2-3 frasi",
  "key_points": ["punto chiave 1", "punto chiave 2", ...],
  "objections": ["obiezione 1", "obiezione 2", ...],
  "outcome": "positivo|neutro|negativo|appuntamento_fissato|non_interessato",
  "next_steps": ["prossimo passo 1", "prossimo passo 2", ...],
  "tags_add": ["tag suggerito 1", ...]
}`;

    console.log("[ai-summary] Calling Lovable AI...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[ai-summary] AI error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    console.log("[ai-summary] AI response received");

    // Parse AI response
    let result: SummaryOutput;
    try {
      let cleanContent = aiContent.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      result = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("[ai-summary] Failed to parse AI response:", parseError);
      result = {
        recap: "Impossibile generare il riassunto automatico.",
        key_points: [],
        objections: [],
        outcome: "neutro",
        next_steps: ["Rivedere manualmente la trascrizione"],
        tags_add: [],
      };
    }

    console.log("[ai-summary] Returning result");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ai-summary] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
