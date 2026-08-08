import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ParsePDFRequest {
  tenant_id: string;
  knowledge_id: string;
  storage_path: string;
}

/**
 * Parse PDF with OCR support using Lovable AI for scanned documents
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenant_id, knowledge_id, storage_path }: ParsePDFRequest = await req.json();

    console.log(`Parsing PDF for tenant ${tenant_id}, knowledge ${knowledge_id}`);

    // Update status to processing
    await supabase
      .from("tenant_knowledge")
      .update({ status: "processing" })
      .eq("id", knowledge_id);

    // Download the PDF from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from("tenant-knowledge")
      .download(storage_path);

    if (downloadError || !fileData) {
      console.error("Error downloading PDF:", downloadError);
      await supabase
        .from("tenant_knowledge")
        .update({ 
          status: "failed", 
          error_message: "Impossibile scaricare il file PDF" 
        })
        .eq("id", knowledge_id);

      return new Response(
        JSON.stringify({ error: "Download failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to text for parsing
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    let extractedText = "";
    let rawText = "";
    let estimatedPages = 1;
    let usedOCR = false;
    
    try {
      const textDecoder = new TextDecoder("utf-8", { fatal: false });
      rawText = textDecoder.decode(bytes);
      
      const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
      let match;
      const textParts: string[] = [];
      
      while ((match = streamRegex.exec(rawText)) !== null) {
        const content = match[1];
        const textRegex = /\((.*?)\)/g;
        let textMatch;
        while ((textMatch = textRegex.exec(content)) !== null) {
          const text = textMatch[1]
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
            .replace(/\\\\/g, "\\");
          if (text.length > 2 && /[a-zA-Z]/.test(text)) {
            textParts.push(text);
          }
        }
      }
      
      extractedText = textParts.join(" ").trim();
      
      const pageCountMatch = rawText.match(/\/Type\s*\/Page[^s]/g);
      estimatedPages = pageCountMatch ? pageCountMatch.length : 1;

      if (extractedText.length < 100 && LOVABLE_API_KEY) {
        console.log(`PDF has minimal text (${extractedText.length} chars), attempting OCR with AI vision`);
        usedOCR = true;
        
        const base64Data = btoa(String.fromCharCode(...bytes));
        
        try {
          const ocrResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: `Questo è un documento PDF. Estrai TUTTO il testo visibile nel documento, incluso testo in immagini, tabelle, intestazioni, paragrafi.
                      
Rispondi SOLO con il testo estratto, senza commenti o formattazione aggiuntiva. Se ci sono più pagine, separa il contenuto con "---".

Se non riesci a leggere il contenuto o il documento è vuoto, rispondi con: "[DOCUMENTO NON LEGGIBILE]"`
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:application/pdf;base64,${base64Data}`
                      }
                    }
                  ]
                }
              ],
              max_tokens: 4000,
            }),
          });

          if (ocrResponse.ok) {
            const ocrResult = await ocrResponse.json();
            const ocrText = ocrResult.choices?.[0]?.message?.content;
            
            if (ocrText && !ocrText.includes("[DOCUMENTO NON LEGGIBILE]") && ocrText.length > 50) {
              extractedText = ocrText;
              console.log(`OCR successful, extracted ${extractedText.length} characters`);
            } else {
              console.log("OCR returned no usable text");
              extractedText = "[PDF scansionato - OCR non ha estratto testo leggibile.]";
            }
          } else {
            console.error("OCR API error:", await ocrResponse.text());
            extractedText = "[PDF con contenuto principalmente grafico - OCR fallito]";
          }
        } catch (ocrError) {
          console.error("OCR processing error:", ocrError);
          extractedText = "[PDF con contenuto principalmente grafico - errore durante OCR]";
        }
      } else if (extractedText.length < 100) {
        extractedText = "[PDF con contenuto principalmente grafico - potrebbe richiedere OCR]";
      }

    } catch (parseError) {
      console.error("PDF parsing error:", parseError);
      extractedText = "[Errore nell'estrazione del testo dal PDF]";
    }

    // Generate summary using AI if we have enough text
    let contentSummary = `PDF caricato: ${estimatedPages} pagine circa`;
    
    if (extractedText.length > 200 && LOVABLE_API_KEY && !extractedText.startsWith("[")) {
      try {
        const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "user",
                content: `Riassumi brevemente in 2-3 frasi il seguente contenuto estratto da un documento PDF (max 150 caratteri):

${extractedText.substring(0, 3000)}`
              }
            ],
            max_tokens: 100,
          }),
        });

        if (summaryResponse.ok) {
          const summaryResult = await summaryResponse.json();
          const summary = summaryResult.choices?.[0]?.message?.content;
          if (summary && summary.length > 10) {
            contentSummary = summary.substring(0, 200);
          }
        }
      } catch (summaryError) {
        console.error("Summary generation error:", summaryError);
      }
    }

    if (usedOCR) {
      contentSummary = `[OCR] ${contentSummary}`;
    }

    // Update the knowledge record
    await supabase
      .from("tenant_knowledge")
      .update({
        status: "completed",
        content_text: extractedText.substring(0, 500000),
        page_count: estimatedPages,
        content_summary: contentSummary,
      })
      .eq("id", knowledge_id);

    console.log(`PDF parsed successfully for knowledge ${knowledge_id}, OCR used: ${usedOCR}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pages: estimatedPages,
        text_length: extractedText.length,
        ocr_used: usedOCR
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Parse PDF error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
