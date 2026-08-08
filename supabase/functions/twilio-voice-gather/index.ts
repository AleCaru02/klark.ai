import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createServiceClient,
  requiredEnv,
  requireActiveTenant,
  verifyTwilioFormSignature,
} from "../_shared/security.ts";
import {
  gatherActionUrl,
  resolveExistingTwilioContext,
  resolveTwilioWebhookAuthToken,
  twimlResponse,
  xmlEscape,
} from "../_shared/twilio-voice.ts";

const MAX_TURNS = 20;

serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await request.text();
  const form = new URLSearchParams(rawBody);
  const supabase = createServiceClient();
  try {
    const twilioAuthToken = await resolveTwilioWebhookAuthToken(supabase, form);
    if (!twilioAuthToken) return new Response("Webhook unavailable", { status: 503 });
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
  } catch (error) {
    console.error("[twilio-voice-gather] Twilio verification unavailable", error);
    return new Response("Webhook unavailable", { status: 503 });
  }

  const callSid = form.get("CallSid") ?? "";
  if (!callSid) return new Response("Missing CallSid", { status: 400 });
  try {
    const context = await resolveExistingTwilioContext(
      supabase,
      callSid,
      new URL(request.url),
    );
    if (!context) return new Response("Unknown call", { status: 404 });

    const dialCallStatus = (form.get("DialCallStatus") ?? "").trim().toLowerCase();
    if (dialCallStatus) {
      return await handleDialResult(supabase, context, dialCallStatus);
    }

    await requireActiveTenant(supabase, context.tenantId);

    const speechResult = (form.get("SpeechResult") ?? "").trim().slice(0, 4000);
    const confidence = Number(form.get("Confidence") ?? "1");
    const actionUrl = gatherActionUrl(requiredEnv("SUPABASE_URL"), context.queueId, context.testMode);
    if (!speechResult) {
      return repeatPrompt(
        "Non ho capito, può ripetere?",
        actionUrl,
      );
    }
    if (Number.isFinite(confidence) && confidence < 0.35) {
      return repeatPrompt(
        "Mi scusi, c'è un po' di disturbo. Potrebbe ripetere?",
        actionUrl,
      );
    }

    const [
      { data: settings, error: settingsError },
      { data: tenant, error: tenantError },
      { data: callLog, error: callLogError },
    ] = await Promise.all([
      supabase
        .from("settings")
        .select(
          "ai_prompt_json,availability_json,booking_rules_json,formality,voice_pack_id,timezone,ai_data_processing_opt_in,voice_enabled,voice_runtime_verified,voice_test_mode",
        )
        .eq("tenant_id", context.tenantId)
        .maybeSingle(),
      supabase
        .from("tenants")
        .select("name")
        .eq("id", context.tenantId)
        .maybeSingle(),
      supabase
        .from("call_logs")
        .select("transcript,outcome_json")
        .eq("tenant_id", context.tenantId)
        .eq("twilio_call_sid", callSid)
        .maybeSingle(),
    ]);
    if (settingsError) throw settingsError;
    if (tenantError) throw tenantError;
    if (callLogError) throw callLogError;

    if (context.testMode) {
      if (settings?.voice_test_mode !== true) {
        return twimlResponse('<Say language="it-IT">Il collaudo Voice non è attivo.</Say><Hangup/>');
      }
    } else if (settings?.voice_enabled !== true || settings?.voice_runtime_verified !== true) {
      return twimlResponse('<Say language="it-IT">Il servizio Voice non è attivo.</Say><Hangup/>');
    }

    const outcome = isRecord(callLog?.outcome_json)
      ? callLog.outcome_json
      : {};
    const turnCount = Number(outcome.turn_count ?? 0) + 1;
    const promptConfiguration = isRecord(settings?.ai_prompt_json) ? settings.ai_prompt_json : {};
    const handoffPhone = validHandoffPhone(promptConfiguration.handoff_phone_e164);
    const isLei = settings?.formality !== "tu";
    const timezone = typeof settings?.timezone === "string"
      ? settings.timezone
      : "Europe/Rome";
    const tenantName = typeof tenant?.name === "string" && tenant.name.trim()
      ? tenant.name.trim().slice(0, 160)
      : "lo studio";
    const userGoodbye = /\b(arrivederci|buona giornata|buona serata|va bene così|basta così|okay grazie|ok grazie|ci sentiamo|a presto)\b/i.test(
      speechResult,
    );

    const history = transcriptToMessages(
      typeof callLog?.transcript === "string" ? callLog.transcript : "",
    );
    history.push({ role: "user", content: speechResult });
    const explicitHumanRequest = wantsHuman(speechResult);

    let aiResponse: string;
    if (explicitHumanRequest) {
      aiResponse = handoffPhone
        ? (isLei ? "Certo. La metto in contatto con una persona." : "Certo. Ti metto in contatto con una persona.")
        : (isLei ? "Certo. Registro la richiesta e La faremo ricontattare da una persona." : "Certo. Registro la richiesta e ti faremo ricontattare da una persona.");
    } else if (userGoodbye && turnCount > 1) {
      aiResponse = `Grazie per aver chiamato. ${dayClosing(timezone)}.`;
    } else if (turnCount > MAX_TURNS) {
      aiResponse = `${isLei ? "La" : "Ti"} ringrazio per la chiamata. ${dayClosing(timezone)}.`;
    } else if (settings?.ai_data_processing_opt_in !== true) {
      aiResponse = isLei
        ? "Per proseguire serve l'attivazione del trattamento AI nelle impostazioni. La faremo richiamare da una persona."
        : "Per proseguire serve l'attivazione del trattamento AI nelle impostazioni. Ti faremo richiamare da una persona.";
    } else {
      const prompt = await buildSystemPrompt(
        supabase,
        context.tenantId,
        context.contactId,
        settings,
        tenantName,
        isLei,
        turnCount,
      );
      aiResponse = await requestAiResponse(prompt, history);
    }

    const transferRequested = explicitHumanRequest || aiResponse.includes("[TRANSFER_TO_HUMAN]");
    aiResponse = aiResponse.replace(/\[TRANSFER_TO_HUMAN\]/g, "").trim();
    if (transferRequested && !handoffPhone) {
      aiResponse = isLei
        ? "Registro la richiesta e La faremo ricontattare da una persona."
        : "Registro la richiesta e ti faremo ricontattare da una persona.";
    }

    const booking = transferRequested ? null : parseBookingCommand(aiResponse);
    let appointmentBooked = false;
    if (booking && context.contactId) {
      const response = await fetch(
        `${requiredEnv("SUPABASE_URL")}/functions/v1/ai-book-appointment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${requiredEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_id: context.tenantId,
            contact_id: context.contactId,
            call_sid: callSid,
            date: booking.date,
            time: booking.time,
            duration_minutes: booking.durationMinutes,
            call_summary: booking.note,
            idempotency_key: `voice:${callSid}:${booking.date}:${booking.time}`,
          }),
        },
      );
      appointmentBooked = response.ok;
      if (!response.ok) {
        console.error("[twilio-voice-gather] Booking rejected", response.status);
        aiResponse = isLei
          ? "Non riesco a confermare l'appuntamento in questo momento. La faremo ricontattare."
          : "Non riesco a confermare l'appuntamento in questo momento. Ti faremo ricontattare.";
      } else {
        aiResponse = aiResponse.replace(/\[BOOK_APPOINTMENT:[^\]]+\]/, "").trim();
      }
    } else {
      aiResponse = aiResponse.replace(/\[BOOK_APPOINTMENT:[^\]]+\]/, "").trim();
    }

    aiResponse = cleanSpokenText(aiResponse) ||
      (isLei ? "Può ripetere, per favore?" : "Puoi ripetere, per favore?");
    const oldTranscript = typeof callLog?.transcript === "string"
      ? callLog.transcript.trim()
      : "";
    const newTranscript = [
      oldTranscript,
      `Cliente: ${speechResult}`,
      `Assistente: ${aiResponse}`,
    ].filter(Boolean).join("\n").slice(-50_000);

    const { error: transcriptError } = await supabase
      .from("call_logs")
      .update({
        transcript: newTranscript,
        outcome_json: {
          ...outcome,
          queue_id: context.queueId,
          turn_count: turnCount,
          appointment_booked: appointmentBooked,
          handoff_requested: transferRequested,
          test_mode: context.testMode,
        },
      })
      .eq("tenant_id", context.tenantId)
      .eq("twilio_call_sid", callSid);
    if (transcriptError) throw transcriptError;

    const callbackIntent = transferRequested || /\b(richiamo|richiamare|richiamata|mi richiami|call back)\b/i.test(
      `${speechResult} ${aiResponse}`,
    );
    if (callbackIntent && !appointmentBooked && context.contactId) {
      await moveContactToStageType(
        supabase,
        context.tenantId,
        context.contactId,
        "callback_scheduled",
      );
    }

    const goodbye = userGoodbye ||
      /\b(arrivederci|buona giornata|buona serata|a presto|ci sentiamo)\b/i.test(
        aiResponse,
      ) || turnCount > MAX_TURNS || settings?.ai_data_processing_opt_in !== true || (transferRequested && !handoffPhone);
    const audioUrl = await synthesizeSpeech(
      supabase,
      aiResponse,
      callSid,
      typeof settings?.voice_pack_id === "string"
        ? settings.voice_pack_id
        : "FGY2WhTYpPnrIDTdsKH5",
    );
    const voiceElement = audioUrl
      ? `<Play>${xmlEscape(audioUrl)}</Play>`
      : `<Say language="it-IT" voice="alice">${xmlEscape(aiResponse)}</Say>`;

    if (transferRequested && handoffPhone) {
      return twimlResponse(`
        ${voiceElement}
        <Dial timeout="20" answerOnBridge="true" action="${xmlEscape(actionUrl)}" method="POST">
          <Number>${xmlEscape(handoffPhone)}</Number>
        </Dial>
      `);
    }

    if (goodbye) {
      if (context.queueId) {
        const { error: queueError } = await supabase
          .from("call_queue")
          .update({
            status: "completed",
            outcome: appointmentBooked ? "appointment_booked" : "call_completed",
            locked_at: null,
            worker_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", context.tenantId)
          .eq("contact_id", context.contactId)
          .eq("id", context.queueId);
        if (queueError) throw queueError;
      }

      if (context.contactId && settings?.ai_data_processing_opt_in === true) {
        const recapResponse = await fetch(
          `${requiredEnv("SUPABASE_URL")}/functions/v1/generate-call-recap`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${requiredEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              call_sid: callSid,
              tenant_id: context.tenantId,
              contact_id: context.contactId,
            }),
          },
        );
        if (!recapResponse.ok) {
          console.error("[twilio-voice-gather] Recap rejected", recapResponse.status);
        }
      }

      return twimlResponse(`${voiceElement}<Pause length="1"/><Hangup/>`);
    }

    const lineCheck = isLei ? "È ancora in linea?" : "Sei ancora in linea?";
    const finalClosing = isLei
      ? "Non sento più nulla. La saluto. Buona giornata."
      : "Non sento più nulla. Ti saluto. Buona giornata.";
    return twimlResponse(`
      ${voiceElement}
      <Gather input="speech" language="it-IT" timeout="6" speechTimeout="auto" enhanced="true" speechModel="phone_call" profanityFilter="false" action="${actionUrl}" method="POST"><Pause length="1"/></Gather>
      <Pause length="1"/>
      <Say language="it-IT" voice="alice">${xmlEscape(lineCheck)}</Say>
      <Gather input="speech" language="it-IT" timeout="8" speechTimeout="auto" enhanced="true" speechModel="phone_call" profanityFilter="false" action="${actionUrl}" method="POST"><Pause length="1"/></Gather>
      <Say language="it-IT" voice="alice">${xmlEscape(finalClosing)}</Say>
      <Hangup/>
    `);
  } catch (error) {
    console.error("[twilio-voice-gather] Processing failed", error);
    return twimlResponse(
      '<Say language="it-IT">Si è verificato un errore. Riprovi più tardi.</Say><Hangup/>',
    );
  }
});

function validHandoffPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

function wantsHuman(message: string): boolean {
  return /(?:\b(?:voglio|vorrei|preferisco)\b.{0,28}\b(?:persona|operatore|responsabile|addetto|collega)\b)|(?:\b(?:parlare|sentire|passare|trasferire)\b.{0,32}\b(?:persona|operatore|responsabile|addetto|collega)\b)|(?:\b(?:passami|trasferiscimi)\b.{0,24}\b(?:qualcuno|operatore|responsabile|addetto|collega)\b)/i.test(message);
}

async function handleDialResult(
  supabase: any,
  context: any,
  dialCallStatus: string,
): Promise<Response> {
  const completed = dialCallStatus === "completed" || dialCallStatus === "answered";
  const { data: callLog, error: callLogError } = await supabase
    .from("call_logs")
    .select("outcome_json")
    .eq("tenant_id", context.tenantId)
    .eq("twilio_call_sid", context.callSid)
    .maybeSingle();
  if (callLogError) throw callLogError;

  const outcome = isRecord(callLog?.outcome_json) ? callLog.outcome_json : {};
  const { error: outcomeError } = await supabase
    .from("call_logs")
    .update({
      outcome_json: {
        ...outcome,
        handoff_attempted: true,
        handoff_status: dialCallStatus,
        handoff_completed: completed,
      },
    })
    .eq("tenant_id", context.tenantId)
    .eq("twilio_call_sid", context.callSid);
  if (outcomeError) throw outcomeError;

  if (context.queueId) {
    const { error: queueError } = await supabase
      .from("call_queue")
      .update({
        status: completed ? "completed" : "no_answer",
        outcome: completed ? "human_handoff" : "human_unavailable",
        locked_at: null,
        worker_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", context.tenantId)
      .eq("id", context.queueId);
    if (queueError) throw queueError;
  }

  if (!completed && context.contactId) {
    await moveContactToStageType(supabase, context.tenantId, context.contactId, "callback_scheduled");
  }

  return completed
    ? twimlResponse("<Hangup/>")
    : twimlResponse('<Say language="it-IT" voice="alice">La persona non è disponibile in questo momento. Abbiamo registrato la richiesta di richiamo.</Say><Hangup/>');
}

function repeatPrompt(message: string, actionUrl: string): Response {
  return twimlResponse(`
    <Say language="it-IT" voice="alice">${xmlEscape(message)}</Say>
    <Gather input="speech" language="it-IT" timeout="6" speechTimeout="auto" enhanced="true" speechModel="phone_call" profanityFilter="false" action="${actionUrl}" method="POST"><Pause length="1"/></Gather>
    <Hangup/>
  `);
}

async function buildSystemPrompt(
  supabase: any,
  tenantId: string,
  contactId: string | null,
  settings: any,
  tenantName: string,
  isLei: boolean,
  turnCount: number,
): Promise<string> {
  let businessContext = `Sei l'assistente telefonica di ${tenantName}.`;
  if (isRecord(settings?.ai_prompt_json)) {
    const generated = settings.ai_prompt_json.generatedPrompt;
    const advanced = isRecord(settings.ai_prompt_json.advanced)
      ? settings.ai_prompt_json.advanced.prompt
      : null;
    if (typeof generated === "string" && generated.trim()) {
      businessContext = generated.slice(0, 12_000);
    } else if (typeof advanced === "string" && advanced.trim()) {
      businessContext = advanced.slice(0, 12_000);
    }
  }

  let prompt = `${businessContext}\n
REGOLE OBBLIGATORIE:
- Rispondi in italiano con massimo due frasi brevi.
- Non inventare informazioni, prezzi, disponibilità o conferme.
- Non usare markdown, emoji, elenchi o testo tecnico.
- Non ripetere dati già comunicati.
- ${isLei ? "Usa il Lei." : "Usa il tu."}
- Turno ${turnCount} di ${MAX_TURNS}.
- Per confermare un appuntamento usa soltanto il tag [BOOK_APPOINTMENT:YYYY-MM-DD,HH:mm,30,NOTA] dopo aver ottenuto data e ora precise.`;

  const handoffRules = isRecord(settings?.ai_prompt_json) && typeof settings.ai_prompt_json.handoff_rules === "string"
    ? settings.ai_prompt_json.handoff_rules.trim().slice(0, 2500)
    : "";
  if (handoffRules) {
    prompt += `\n- Regole di passaggio umano: ${handoffRules}`;
    prompt += "\n- Se queste regole richiedono una persona, aggiungi [TRANSFER_TO_HUMAN] alla fine della risposta. Non inserire mai numeri di telefono.";
  }

  const { data: knowledge, error: knowledgeError } = await supabase
    .from("tenant_knowledge")
    .select("source_name,content_summary,content_text")
    .eq("tenant_id", tenantId)
    .eq("status", "completed")
    .limit(10);
  if (knowledgeError) throw knowledgeError;
  for (const source of knowledge ?? []) {
    const summary = typeof source.content_summary === "string"
      ? source.content_summary
      : "";
    const content = typeof source.content_text === "string" &&
        !source.content_text.startsWith("[")
      ? source.content_text.slice(0, 2500)
      : "";
    if (summary || content) {
      prompt += `\n\nFONTE ${String(source.source_name ?? "azienda").slice(0, 120)}:\n${summary}\n${content}`;
    }
  }

  if (contactId) {
    const [contactResult, formResult, notesResult, recapResult] = await Promise.all([
      supabase
        .from("contacts")
        .select("name")
        .eq("tenant_id", tenantId)
        .eq("id", contactId)
        .maybeSingle(),
      supabase
        .from("lead_form_answers")
        .select("answers_json")
        .eq("tenant_id", tenantId)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("lead_notes")
        .select("note_text")
        .eq("tenant_id", tenantId)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("lead_call_recaps")
        .select("summary_bullets_json,next_step")
        .eq("tenant_id", tenantId)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    for (const result of [contactResult, formResult, notesResult, recapResult]) {
      if (result.error) throw result.error;
    }

    if (contactResult.data?.name) {
      prompt += `\n\nNOME CONTATTO: ${String(contactResult.data.name).slice(0, 160)}`;
    }
    if (isRecord(formResult.data?.answers_json)) {
      prompt += `\nMODULO: ${JSON.stringify(formResult.data.answers_json).slice(0, 4000)}`;
    }
    const notes = (notesResult.data ?? [])
      .map((row: any) => String(row.note_text ?? "").slice(0, 1000))
      .filter(Boolean);
    if (notes.length) prompt += `\nNOTE: ${notes.join(" | ")}`;
    if (Array.isArray(recapResult.data?.summary_bullets_json)) {
      prompt += `\nCHIAMATA PRECEDENTE: ${recapResult.data.summary_bullets_json.join("; ").slice(0, 3000)}`;
    }
    if (recapResult.data?.next_step) {
      prompt += `\nPROSSIMO PASSO: ${String(recapResult.data.next_step).slice(0, 1000)}`;
    }
  }

  if (isRecord(settings?.availability_json)) {
    prompt += `\nDISPONIBILITÀ: ${JSON.stringify(settings.availability_json).slice(0, 2000)}`;
  }
  if (isRecord(settings?.booking_rules_json)) {
    prompt += `\nREGOLE PRENOTAZIONE: ${JSON.stringify(settings.booking_rules_json).slice(0, 1500)}`;
  }
  return prompt.slice(0, 30_000);
}

async function requestAiResponse(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) return "Mi scusi, il servizio AI non è disponibile. La faremo richiamare da una persona.";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-20),
      ],
      max_tokens: 220,
      temperature: 0.35,
    }),
  });
  if (!response.ok) {
    console.error("[twilio-voice-gather] OpenAI rejected", response.status);
    return "Mi scusi, ho avuto un problema con il servizio AI. La faremo richiamare da una persona.";
  }

  const data = await response.json() as any;
  return typeof data?.choices?.[0]?.message?.content === "string"
    ? data.choices[0].message.content
    : "Mi scusi, può ripetere?";
}

function parseBookingCommand(value: string): {
  date: string;
  time: string;
  durationMinutes: number;
  note: string;
} | null {
  const match = value.match(
    /\[BOOK_APPOINTMENT:(\d{4}-\d{2}-\d{2}),(\d{2}:\d{2})(?:,(\d{1,3}))?,([^\]]{1,500})\]/,
  );
  if (!match) return null;
  const duration = Math.min(240, Math.max(15, Number(match[3] || 30)));
  return {
    date: match[1],
    time: match[2],
    durationMinutes: duration,
    note: match[4].trim(),
  };
}

function transcriptToMessages(
  transcript: string,
): Array<{ role: string; content: string }> {
  return transcript.split("\n").slice(-40).flatMap((line) => {
    if (line.startsWith("Cliente: ")) {
      return [{ role: "user", content: line.slice("Cliente: ".length).slice(0, 4000) }];
    }
    if (line.startsWith("Assistente: ")) {
      return [{ role: "assistant", content: line.slice("Assistente: ".length).slice(0, 4000) }];
    }
    return [];
  });
}

function cleanSpokenText(value: string): string {
  return value
    .replace(/\*+/g, "")
    .replace(/#+\s*/g, "")
    .replace(/`+/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 2000);
}

async function moveContactToStageType(
  supabase: any,
  tenantId: string,
  contactId: string,
  stageType: string,
): Promise<void> {
  const { data: stage, error: stageError } = await supabase
    .from("stages")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("stage_type", stageType)
    .eq("is_active", true)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (stageError) throw stageError;
  if (!stage?.id) return;

  const { data: existing, error: existingError } = await supabase
    .from("contact_stages")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .maybeSingle();
  if (existingError) throw existingError;

  const { error } = existing
    ? await supabase
      .from("contact_stages")
      .update({ stage_id: stage.id, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", existing.id)
    : await supabase.from("contact_stages").insert({
      tenant_id: tenantId,
      contact_id: contactId,
      stage_id: stage.id,
    });
  if (error) throw error;
}

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
            style: 0.15,
            use_speaker_boost: true,
          },
        }),
      },
    );
    if (!response.ok) {
      console.error("[twilio-voice-gather] TTS rejected", response.status);
      return null;
    }

    const path = `voice-responses/${callSid}-${Date.now()}.mp3`;
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
    console.error("[twilio-voice-gather] TTS failed", error);
    return null;
  }
}

function dayClosing(timezone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  return hour >= 18 ? "Buona serata" : "Buona giornata";
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
