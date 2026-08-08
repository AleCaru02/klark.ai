import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createServiceClient,
  requiredEnv,
  verifyTwilioFormSignature,
} from "../_shared/security.ts";
import {
  gatherActionUrl,
  resolveExistingTwilioContext,
  resolveInboundTwilioContext,
  twimlResponse,
  xmlEscape,
} from "../_shared/twilio-voice.ts";

serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await request.text();
  const form = new URLSearchParams(rawBody);
  let twilioAuthToken: string;
  try {
    twilioAuthToken = requiredEnv("TWILIO_AUTH_TOKEN");
  } catch (error) {
    console.error("[twilio-voice-webhook] Twilio verification unavailable", error);
    return new Response("Webhook unavailable", { status: 503 });
  }

  if (
    !(await verifyTwilioFormSignature(
      request.url,
      form,
      request.headers.get("X-Twilio-Signature"),
      twilioAuthToken,
    ))
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const callSid = form.get("CallSid") ?? "";
  const direction = form.get("Direction") ?? "";
  const from = form.get("From") ?? "";
  const to = form.get("To") ?? "";
  const answeredBy = form.get("AnsweredBy") ?? "";
  if (!callSid) return new Response("Missing CallSid", { status: 400 });

  const supabase = createServiceClient();

  try {
    let context = await resolveExistingTwilioContext(
      supabase,
      callSid,
      new URL(request.url),
    );
    if (!context && direction === "inbound") {
      context = await resolveInboundTwilioContext(
        supabase,
        callSid,
        from,
        to,
      );
    }
    if (!context) {
      console.error("[twilio-voice-webhook] Unable to resolve call context", {
        call_sid: callSid,
        direction,
      });
      return twimlResponse(
        '<Say language="it-IT">Mi dispiace, il servizio non è disponibile.</Say><Hangup/>',
      );
    }

    if (["machine_start", "machine_end_beep", "machine_end_silence"].includes(answeredBy)) {
      if (context.queueId) {
        const { error } = await supabase
          .from("call_queue")
          .update({
            status: "no_answer",
            notes: "Segreteria telefonica rilevata",
            last_voice_outcome: "machine",
            last_error_code: "answering_machine",
            locked_at: null,
            worker_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", context.queueId)
          .eq("tenant_id", context.tenantId)
          .eq("contact_id", context.contactId);
        if (error) throw error;
      }
      return twimlResponse("<Hangup/>");
    }

    const [{ data: settings, error: settingsError }, { data: tenant, error: tenantError }] =
      await Promise.all([
        supabase
          .from("settings")
          .select("formality,voice_pack_id,timezone")
          .eq("tenant_id", context.tenantId)
          .maybeSingle(),
        supabase
          .from("tenants")
          .select("name")
          .eq("id", context.tenantId)
          .maybeSingle(),
      ]);
    if (settingsError) throw settingsError;
    if (tenantError) throw tenantError;

    let contactName: string | null = null;
    if (context.contactId) {
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select("name")
        .eq("tenant_id", context.tenantId)
        .eq("id", context.contactId)
        .maybeSingle();
      if (contactError) throw contactError;
      const rawName = typeof contact?.name === "string" ? contact.name.trim() : "";
      if (rawName && rawName !== "Chiamata in entrata") {
        contactName = rawName.split(/\s+/)[0].slice(0, 80);
      }
    }

    const timezone = typeof settings?.timezone === "string"
      ? settings.timezone
      : "Europe/Rome";
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date()),
    );
    const timeGreeting = hour < 13
      ? "Buongiorno"
      : hour < 18
      ? "Buon pomeriggio"
      : "Buonasera";
    const isLei = settings?.formality !== "tu";
    const tenantName = typeof tenant?.name === "string" && tenant.name.trim()
      ? tenant.name.trim().slice(0, 160)
      : "lo studio";
    const inbound = context.direction === "inbound" || direction === "inbound";

    const greeting = inbound
      ? contactName
        ? `${timeGreeting} ${contactName}, ha chiamato ${tenantName}. Come posso ${isLei ? "aiutarLa" : "aiutarti"}?`
        : `${timeGreeting}, ${tenantName}. Come posso ${isLei ? "aiutarLa" : "aiutarti"}?`
      : contactName
      ? `${timeGreeting} ${contactName}, ${isLei ? "La" : "ti"} chiamo da ${tenantName}. ${isLei ? "Ha" : "Hai"} un momento?`
      : `${timeGreeting}, ${isLei ? "La" : "ti"} chiamo da ${tenantName}. ${isLei ? "Ha" : "Hai"} un momento?`;

    const { error: callLogError } = await supabase.from("call_logs").upsert({
      tenant_id: context.tenantId,
      contact_id: context.contactId,
      direction: inbound ? "inbound" : "outbound",
      twilio_call_sid: callSid,
      transcript: `Assistente: ${greeting}`,
      outcome_json: {
        queue_id: context.queueId,
        turn_count: 0,
      },
    }, { onConflict: "twilio_call_sid" });
    if (callLogError) throw callLogError;

    const audioUrl = await synthesizeSpeech(
      supabase,
      greeting,
      callSid,
      typeof settings?.voice_pack_id === "string"
        ? settings.voice_pack_id
        : "FGY2WhTYpPnrIDTdsKH5",
    );
    const voiceElement = audioUrl
      ? `<Play>${xmlEscape(audioUrl)}</Play>`
      : `<Say language="it-IT" voice="alice">${xmlEscape(greeting)}</Say>`;
    const actionUrl = gatherActionUrl(requiredEnv("SUPABASE_URL"), context.queueId);
    const followUp = isLei ? "È ancora in linea?" : "Sei ancora in linea?";
    const closing = isLei
      ? "Non sento risposta. La richiameremo. Buona giornata."
      : "Non sento risposta. Ti richiameremo. Buona giornata.";

    return twimlResponse(`
      ${voiceElement}
      <Gather input="speech" language="it-IT" timeout="5" speechTimeout="auto" enhanced="true" speechModel="phone_call" profanityFilter="false" action="${actionUrl}" method="POST"><Pause length="1"/></Gather>
      <Pause length="1"/>
      <Say language="it-IT" voice="alice">${xmlEscape(followUp)}</Say>
      <Gather input="speech" language="it-IT" timeout="8" speechTimeout="auto" enhanced="true" speechModel="phone_call" profanityFilter="false" action="${actionUrl}" method="POST"><Pause length="1"/></Gather>
      <Say language="it-IT" voice="alice">${xmlEscape(closing)}</Say>
      <Hangup/>
    `);
  } catch (error) {
    console.error("[twilio-voice-webhook] Processing failed", error);
    return twimlResponse(
      '<Say language="it-IT">Si è verificato un errore. Riprovi più tardi.</Say><Hangup/>',
    );
  }
});

async function synthesizeSpeech(
  supabase: any,
  text: string,
  callSid: string,
  voiceId: string,
): Promise<string | null> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY")?.trim();
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.65,
            similarity_boost: 0.82,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      },
    );
    if (!response.ok) {
      console.error("[twilio-voice-webhook] TTS rejected", response.status);
      return null;
    }

    const path = `voice-responses/greeting-${callSid}-${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from("voice-audio")
      .upload(path, new Uint8Array(await response.arrayBuffer()), {
        contentType: "audio/mpeg",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data, error: signedError } = await supabase.storage
      .from("voice-audio")
      .createSignedUrl(path, 300);
    if (signedError) throw signedError;
    return data?.signedUrl ?? null;
  } catch (error) {
    console.error("[twilio-voice-webhook] TTS failed", error);
    return null;
  }
}
