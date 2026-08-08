import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/security.ts";

const allowedOrigins = new Set([
  "https://www.clerkai.it",
  "https://clerkai.it",
  "https://clark-ai.lovable.app",
  "https://clerkai-preview-alecaru02.vercel.app",
]);

const clips = {
  appointment: "Buongiorno. Certamente, posso aiutarla a fissare un appuntamento. Verifico subito le disponibilità: al momento posso proporle martedì alle quindici e trenta oppure giovedì alle dieci. Quale preferisce?",
  reschedule: "Certo, posso aiutarla a spostare l'appuntamento. Prima verifico la prenotazione esistente e poi controllo le alternative disponibili, così le propongo soltanto orari realmente liberi.",
  exception: "Ho capito la richiesta. In questo caso non devo improvvisare una risposta. Raccolgo le informazioni necessarie e passo la richiesta alla persona corretta con il contesto già pronto.",
  professional: "Posso raccogliere il motivo della richiesta e verificare gli orari disponibili. Per le informazioni specifiche che richiedono il professionista, preparo il contesto e passo la richiesta allo studio.",
  healthcare: "Posso verificare lo spostamento della visita. Per il problema urgente, invece, interrompo il flusso automatico e inoltro subito la richiesta al referente indicato dallo studio.",
  property: "Raccolgo l'immobile, il problema, il livello di urgenza e la sua disponibilità. Se emerge un rischio o un blocco del soggiorno, passo subito il caso al responsabile con tutte le informazioni raccolte.",
  beauty: "Posso verificare i servizi disponibili e proporle gli orari liberi. Se la scelta del trattamento richiede una valutazione professionale, raccolgo la richiesta e coinvolgo una persona dello staff.",
} as const;

type ClipId = keyof typeof clips;

const demoVersion = "v1";
const bucketName = "voice-audio";
const folder = "public-demos";

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(origin: string, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isClipId(value: unknown): value is ClipId {
  return typeof value === "string" && value in clips;
}

serve(async (request) => {
  const origin = request.headers.get("Origin") ?? "";
  if (!allowedOrigins.has(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") return json(origin, { error: "Method not allowed" }, 405);

  let payload: { clipId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json(origin, { error: "Invalid request" }, 400);
  }

  if (!isClipId(payload.clipId)) {
    return json(origin, { error: "Invalid clip" }, 400);
  }

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY")?.trim();
  if (!apiKey) return json(origin, { error: "Voice provider unavailable" }, 503);

  const voiceId = Deno.env.get("ELEVENLABS_DEFAULT_VOICE_ID")?.trim() || "FGY2WhTYpPnrIDTdsKH5";
  const modelId = Deno.env.get("ELEVENLABS_DEMO_MODEL")?.trim() || "eleven_multilingual_v2";
  const fileName = `${demoVersion}-${payload.clipId}-${voiceId.slice(0, 10)}.mp3`;
  const objectPath = `${folder}/${fileName}`;
  const supabase = createServiceClient();

  try {
    const { data: existingFiles, error: listError } = await supabase.storage
      .from(bucketName)
      .list(folder, { search: fileName, limit: 1 });
    if (listError) throw listError;

    if (!existingFiles?.some((file) => file.name === fileName)) {
      const providerResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          body: JSON.stringify({
            text: clips[payload.clipId],
            model_id: modelId,
            voice_settings: {
              stability: 0.46,
              similarity_boost: 0.84,
              style: 0,
              speed: 0.98,
              use_speaker_boost: true,
            },
          }),
        },
      );

      if (!providerResponse.ok) {
        console.error("[public-voice-demo] ElevenLabs rejected request", providerResponse.status);
        return json(origin, { error: "Voice provider unavailable" }, 502);
      }

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(objectPath, new Uint8Array(await providerResponse.arrayBuffer()), {
          contentType: "audio/mpeg",
          cacheControl: "31536000",
          upsert: true,
        });
      if (uploadError) throw uploadError;
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(objectPath, 60 * 15);
    if (signedError || !signed?.signedUrl) throw signedError ?? new Error("Unable to sign demo audio");

    return json(origin, {
      audioUrl: signed.signedUrl,
      provider: "ElevenLabs",
      clipId: payload.clipId,
    });
  } catch (error) {
    console.error("[public-voice-demo] Failed", error);
    return json(origin, { error: "Unable to load voice demo" }, 500);
  }
});
