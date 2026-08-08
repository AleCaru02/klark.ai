import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const allowedVoiceIds = new Set([
  "8KInRSd4DtD5L5gK7itu",
  "4YsN90HrCPrOCmBglwMA",
  "MTgv1KRJpUnc34UMGTHK",
]);

const appOrigin = Deno.env.get("PUBLIC_APP_URL") ?? "https://www.clerkai.it";
const corsHeaders = {
  "Access-Control-Allow-Origin": appOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

interface TTSRequest {
  text?: unknown;
  voiceId?: unknown;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (Deno.env.get("TTS_PREVIEW_ENABLED") !== "true") {
    return json({ error: "Voice preview is disabled" }, 410);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !publishableKey || !authorization?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) return json({ error: "Voice provider unavailable" }, 503);

    const payload = await req.json() as TTSRequest;
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    const voiceId = typeof payload.voiceId === "string" ? payload.voiceId : "";

    if (!text || text.length > 200 || !allowedVoiceIds.has(voiceId)) {
      return json({ error: "Invalid request" }, 400);
    }

    const providerResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!providerResponse.ok) return json({ error: "Voice provider unavailable" }, 502);

    const audioContent = base64Encode(await providerResponse.arrayBuffer());
    return json({ audioContent });
  } catch {
    return json({ error: "Unable to generate voice preview" }, 500);
  }
});
