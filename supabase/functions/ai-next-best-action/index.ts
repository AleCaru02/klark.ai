import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NextBestActionOutput {
  next_action: "CALL" | "WHATSAPP" | "WAIT" | "CLOSE";
  planned_delay_minutes: number;
  call_script: {
    opening: string;
    questions: string[];
    objection_handlers: string[];
    closing: string;
  };
  whatsapp_message: string;
  crm_updates: {
    status: string;
    priority_score_delta: number;
    tags_add: string[];
    tags_remove: string[];
  };
  reminders: {
    send_confirm_now: boolean;
    send_24h_before: boolean;
    send_2h_before: boolean;
  };
  safety: {
    opt_out_detected: boolean;
    compliance_notes: string;
  };
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

    const { tenant_id, lead_id } = await req.json();

    if (!tenant_id || !lead_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id and lead_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ai-next-best-action] Processing lead ${lead_id} for tenant ${tenant_id}`);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Load lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (leadError || !lead) {
      console.error("[ai-next-best-action] Lead not found:", leadError);
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load followup rules
    const { data: rules } = await supabase
      .from("followup_rules")
      .select("*")
      .eq("tenant_id", tenant_id)
      .single();

    const followupRules = rules || {
      max_attempts_call: 3,
      max_attempts_whatsapp: 4,
      retry_after_no_answer_minutes: 240,
      daily_call_window_start: "09:00",
      daily_call_window_end: "19:00",
      quiet_hours_start: "21:00",
      quiet_hours_end: "08:00",
      stop_words: ["STOP", "ANNULLA", "NON SCRIVERMI"],
      tone: "professionale, umano, diretto",
      sector: "professionista generico",
    };

    // Load last 10 interactions
    const { data: interactions } = await supabase
      .from("interactions")
      .select("*")
      .eq("lead_id", lead_id)
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const recentInteractions = interactions || [];

    // Check for stop words in interactions
    const stopWords = followupRules.stop_words || [];
    let optOutDetected = false;
    for (const interaction of recentInteractions) {
      if (interaction.content) {
        const contentUpper = interaction.content.toUpperCase();
        for (const stopWord of stopWords) {
          if (contentUpper.includes(stopWord.toUpperCase())) {
            optOutDetected = true;
            break;
          }
        }
      }
      if (interaction.outcome === "opt_out") {
        optOutDetected = true;
      }
      if (optOutDetected) break;
    }

    // Check if last 2 call interactions were no_answer
    const callInteractions = recentInteractions.filter(i => i.channel === "call");
    const lastTwoCallsNoAnswer = callInteractions.length >= 2 &&
      callInteractions[0].outcome === "no_answer" &&
      callInteractions[1].outcome === "no_answer";

    // Count attempts
    const callAttempts = recentInteractions.filter(i => i.channel === "call").length;
    const whatsappAttempts = recentInteractions.filter(i => i.channel === "whatsapp").length;

    // Build context for AI
    const context = {
      lead: {
        name: lead.name,
        phone: lead.phone_e164,
        email: lead.email,
        source: lead.source,
        status: lead.status,
        priority_score: lead.priority_score,
        tags: lead.tags,
        notes: lead.notes,
        form_payload: lead.form_payload,
      },
      rules: {
        tone: followupRules.tone,
        sector: followupRules.sector,
        max_attempts_call: followupRules.max_attempts_call,
        max_attempts_whatsapp: followupRules.max_attempts_whatsapp,
        retry_after_no_answer_minutes: followupRules.retry_after_no_answer_minutes,
      },
      history: {
        call_attempts: callAttempts,
        whatsapp_attempts: whatsappAttempts,
        last_two_calls_no_answer: lastTwoCallsNoAnswer,
        recent_interactions: recentInteractions.slice(0, 5).map(i => ({
          channel: i.channel,
          outcome: i.outcome,
          content: i.content?.substring(0, 200),
          created_at: i.created_at,
        })),
      },
      opt_out_detected: optOutDetected,
    };

    // If opt-out detected, return CLOSE immediately
    if (optOutDetected) {
      console.log("[ai-next-best-action] Opt-out detected, returning CLOSE");
      const result: NextBestActionOutput = {
        next_action: "CLOSE",
        planned_delay_minutes: 0,
        call_script: { opening: "", questions: [], objection_handlers: [], closing: "" },
        whatsapp_message: "",
        crm_updates: {
          status: "DO_NOT_CONTACT",
          priority_score_delta: -100,
          tags_add: ["opt_out"],
          tags_remove: [],
        },
        reminders: { send_confirm_now: false, send_24h_before: false, send_2h_before: false },
        safety: { opt_out_detected: true, compliance_notes: "Lead ha richiesto di non essere contattato" },
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Lovable AI
    const systemPrompt = `Sei un assistente AI per un CRM di follow-up lead. Analizza il contesto del lead e decidi la prossima azione migliore.

REGOLE RIGIDE:
1. Se call_attempts >= max_attempts_call E whatsapp_attempts >= max_attempts_whatsapp -> next_action = "CLOSE"
2. Se last_two_calls_no_answer = true -> preferisci "WHATSAPP" se non hai superato max_attempts_whatsapp
3. Il messaggio WhatsApp deve essere MAX 350 caratteri con 1 sola CTA chiara
4. Le domande del call script devono essere MAX 3
5. Il tono deve essere: ${followupRules.tone}
6. Il settore è: ${followupRules.sector}

RISPONDI SOLO con un JSON valido nel formato richiesto, senza markdown o testo aggiuntivo.`;

    const userPrompt = `Contesto lead:
${JSON.stringify(context, null, 2)}

Genera la prossima azione migliore. Rispondi SOLO con JSON nel formato:
{
  "next_action": "CALL|WHATSAPP|WAIT|CLOSE",
  "planned_delay_minutes": number,
  "call_script": { "opening": string, "questions": string[], "objection_handlers": string[], "closing": string },
  "whatsapp_message": string (max 350 chars, 1 CTA),
  "crm_updates": { "status": string, "priority_score_delta": number, "tags_add": string[], "tags_remove": string[] },
  "reminders": { "send_confirm_now": boolean, "send_24h_before": boolean, "send_2h_before": boolean },
  "safety": { "opt_out_detected": boolean, "compliance_notes": string }
}`;

    console.log("[ai-next-best-action] Calling Lovable AI...");

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
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[ai-next-best-action] AI error:", aiResponse.status, errorText);
      
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
    
    console.log("[ai-next-best-action] AI response received");

    // Parse AI response
    let result: NextBestActionOutput;
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
      console.error("[ai-next-best-action] Failed to parse AI response:", parseError, aiContent);
      result = {
        next_action: lastTwoCallsNoAnswer ? "WHATSAPP" : "CALL",
        planned_delay_minutes: followupRules.retry_after_no_answer_minutes,
        call_script: {
          opening: `Buongiorno, sono [Nome]. Chiamo per ${lead.source || 'la sua richiesta'}.`,
          questions: ["Come posso aiutarla oggi?", "Qual è il suo obiettivo principale?"],
          objection_handlers: ["Capisco le sue preoccupazioni, mi permetta di chiarire..."],
          closing: "Possiamo fissare un appuntamento per approfondire?",
        },
        whatsapp_message: `Buongiorno ${lead.name}, la contatto in merito alla sua richiesta. Quando possiamo sentirci? Risponda a questo messaggio o chiami al [numero].`,
        crm_updates: { status: lead.status, priority_score_delta: 0, tags_add: [], tags_remove: [] },
        reminders: { send_confirm_now: false, send_24h_before: true, send_2h_before: true },
        safety: { opt_out_detected: false, compliance_notes: "" },
      };
    }

    // Validate whatsapp message length
    if (result.whatsapp_message && result.whatsapp_message.length > 350) {
      result.whatsapp_message = result.whatsapp_message.substring(0, 347) + "...";
    }

    // Validate questions length
    if (result.call_script?.questions?.length > 3) {
      result.call_script.questions = result.call_script.questions.slice(0, 3);
    }

    console.log("[ai-next-best-action] Returning result:", result.next_action);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ai-next-best-action] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
