import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://clerkai-preview-alecaru02.vercel.app",
  "https://www.clerkai.it",
  "https://clerkai.it",
]);

const MAX_MESSAGE_LENGTH = 1500;

function cors(origin: string | null) {
  const allowed = Boolean(origin && ALLOWED_ORIGINS.has(origin));
  return {
    allowed,
    headers: {
      "Access-Control-Allow-Origin": allowed ? origin! : "null",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

function clean(value: unknown, max = MAX_MESSAGE_LENGTH) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function isCalendarQuestion(message: string) {
  return /google\s*calendar|calendario|agenda|appuntament|disponibilit|prenot/i.test(message);
}

function isGoogleAccessBlocked(message: string) {
  return /403|access[_ ]?denied|accesso bloccato|non ha completato.*verifica|tester|testing/i.test(message);
}

function boolFlag(flags: Record<string, unknown>, name: string) {
  return flags?.[name] === true;
}

function fallbackFromContext(ctx: RuntimeContext) {
  const parts = [`Il tuo piano configurato è ${ctx.planName}.`];
  if (ctx.serviceStatus !== "active") {
    parts.push("L'account è ancora in configurazione/collaudo, quindi alcune funzioni possono essere incluse nel piano ma non ancora attive.");
  }
  parts.push("Posso verificare per te cosa è incluso, cosa è già configurato e cosa manca prima dell'attivazione.");
  return parts.join(" ");
}

type RuntimeContext = {
  tenantId: string;
  tenantName: string;
  planCode: string;
  planName: string;
  serviceStatus: string;
  calendarIncluded: boolean;
  calendarConnected: boolean;
  selectedCalendarId: string | null;
  voiceIncluded: boolean;
  voiceConfigured: boolean;
  voiceVerified: boolean;
  whatsappIncluded: boolean;
  metaIncluded: boolean;
  siteChatIncluded: boolean;
  crmIncluded: boolean;
  followupIncluded: boolean;
};

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  const { allowed, headers } = cors(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: allowed ? 204 : 403, headers });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);
  if (!allowed) return json({ error: "Origin not allowed" }, 403, headers);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing server configuration");

    const authorization = request.headers.get("Authorization") || "";
    const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) return json({ error: "Sessione non valida" }, 401, headers);

    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await client.auth.getUser(bearer);
    const userId = userData.user?.id;
    if (userError || !userId) return json({ error: "Sessione scaduta" }, 401, headers);

    const { data: membership, error: membershipError } = await client
      .from("memberships")
      .select("tenant_id,role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership?.tenant_id) return json({ error: "Account non associato a un'azienda" }, 403, headers);

    const tenantId = membership.tenant_id as string;
    const body = await request.json().catch(() => ({}));
    const message = clean((body as Record<string, unknown>).message);
    if (!message) return json({ error: "Messaggio non valido" }, 400, headers);

    const [tenantResult, serviceResult, settingsResult, googleResult] = await Promise.all([
      client.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
      client.from("tenant_service_accounts").select("plan_code,status,activated_at,service_end_at").eq("tenant_id", tenantId).maybeSingle(),
      client.from("settings").select("calendar_id,calendar_enabled,voice_enabled,voice_runtime_verified,whatsapp_enabled,whatsapp_runtime_verified,meta_autocall_runtime_verified").eq("tenant_id", tenantId).maybeSingle(),
      client.from("google_tokens").select("calendar_id,token_expires_at,scope").eq("tenant_id", tenantId).maybeSingle(),
    ]);

    if (tenantResult.error) throw tenantResult.error;
    if (serviceResult.error) throw serviceResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (googleResult.error) throw googleResult.error;

    const planCode = serviceResult.data?.plan_code || "non_configurato";
    const { data: plan, error: planError } = await client
      .from("plans")
      .select("name,feature_flags")
      .eq("code", planCode)
      .maybeSingle();
    if (planError) throw planError;

    const flags = (plan?.feature_flags && typeof plan.feature_flags === "object")
      ? plan.feature_flags as Record<string, unknown>
      : {};

    const ctx: RuntimeContext = {
      tenantId,
      tenantName: tenantResult.data?.name || "La tua attività",
      planCode,
      planName: plan?.name || planCode,
      serviceStatus: serviceResult.data?.status || "non_configurato",
      calendarIncluded: boolFlag(flags, "calendar_enabled"),
      calendarConnected: Boolean(googleResult.data),
      selectedCalendarId: googleResult.data?.calendar_id || settingsResult.data?.calendar_id || null,
      voiceIncluded: boolFlag(flags, "voice_enabled"),
      voiceConfigured: settingsResult.data?.voice_enabled === true,
      voiceVerified: settingsResult.data?.voice_runtime_verified === true,
      whatsappIncluded: boolFlag(flags, "whatsapp_enabled"),
      metaIncluded: boolFlag(flags, "ads_enabled"),
      siteChatIncluded: boolFlag(flags, "site_chat_enabled"),
      crmIncluded: boolFlag(flags, "crm_basic_enabled") || boolFlag(flags, "crm_advanced_enabled"),
      followupIncluded: boolFlag(flags, "followup_basic_enabled") || boolFlag(flags, "followup_advanced_enabled"),
    };

    if (isCalendarQuestion(message)) {
      if (!ctx.calendarIncluded) {
        return json({
          answer: `Nel tuo piano ${ctx.planName} Google Calendar non risulta incluso. Per questo non posso guidarti ad attivarlo su questo account. Posso però indicarti quale piano lo comprende o verificare se il piano assegnato è corretto.`,
          links: [{ label: "Confronta i piani", href: "/pricing" }],
          context: { plan: ctx.planName, calendar_included: false },
        }, 200, headers);
      }

      if (ctx.calendarConnected) {
        return json({
          answer: `Google Calendar risulta già collegato al tuo account ${ctx.planName}${ctx.selectedCalendarId ? ` (calendario selezionato: ${ctx.selectedCalendarId})` : ""}. Puoi gestire la connessione da Integrazioni → Google Calendar. Se vuoi, posso anche guidarti nel test di disponibilità e creazione di un appuntamento.`,
          links: [{ label: "Apri Google Calendar", href: "/app/integrations/google-calendar" }],
          context: { plan: ctx.planName, calendar_included: true, calendar_connected: true },
        }, 200, headers);
      }

      const testingNote = isGoogleAccessBlocked(message)
        ? " L'errore 403 che stai vedendo indica che Google sta bloccando l'autorizzazione prima del ritorno a ClerkAI: durante la fase di test l'account Google deve essere inserito tra gli utenti di test autorizzati del progetto OAuth."
        : "";

      return json({
        answer: `Il tuo piano ${ctx.planName} include Google Calendar, ma al momento non risulta collegato. Per collegarlo: 1) apri Integrazioni → Google Calendar; 2) clicca “Collega Google Calendar”; 3) accedi con l'account Google che contiene l'agenda da usare; 4) autorizza i permessi richiesti; 5) torna su ClerkAI e verifica che lo stato diventi “Collegato”; 6) seleziona il calendario da usare per gli appuntamenti. ${ctx.serviceStatus !== "active" ? "Il tuo account è ancora in configurazione/collaudo, quindi stiamo verificando il flusso prima dell'attivazione definitiva." : ""}${testingNote}`.trim(),
        links: [{ label: "Apri Google Calendar", href: "/app/integrations/google-calendar" }],
        context: { plan: ctx.planName, calendar_included: true, calendar_connected: false, service_status: ctx.serviceStatus },
      }, 200, headers);
    }

    const { data: knowledge } = await client
      .from("tenant_knowledge")
      .select("source_name,content_summary,content_text")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .limit(12);

    const runtime = {
      plan: ctx.planName,
      service_status: ctx.serviceStatus,
      calendar: { included: ctx.calendarIncluded, connected: ctx.calendarConnected },
      voice: { included: ctx.voiceIncluded, configured: ctx.voiceConfigured, verified: ctx.voiceVerified },
      crm: { included: ctx.crmIncluded },
      followup: { included: ctx.followupIncluded },
      site_chat: { included: ctx.siteChatIncluded },
      whatsapp: { included: ctx.whatsappIncluded, active: false },
      meta_lead_ads: { included: ctx.metaIncluded, active: false },
    };

    const sourceText = (knowledge || []).map((row, index) =>
      `FONTE ${index + 1}: ${row.source_name}\n${row.content_summary || ""}\n${String(row.content_text || "").slice(0, 3500)}`
    ).join("\n\n").slice(0, 26000);

    const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
    if (!apiKey) {
      return json({ answer: fallbackFromContext(ctx), links: [{ label: "Panoramica", href: "/app" }] }, 200, headers);
    }

    const system = `Sei l'assistente operativo autenticato di ClerkAI. Stai parlando con un utente già loggato: usa lo STATO ACCOUNT REALE per rispondere sul suo piano e sulle funzioni disponibili.\n\nRegole:\n- Distingui sempre tra: incluso nel piano, configurato, verificato e attivo.\n- Non dire mai che una funzione è attiva se lo stato account non lo conferma.\n- Se una funzione non è disponibile, spiega il motivo concreto (piano, configurazione mancante, collaudo o integrazione non attiva).\n- Google Calendar può essere guidato passo passo solo se calendar.included=true; consideralo collegato solo se calendar.connected=true.\n- WhatsApp e Meta Lead Ads NON sono attivi nella Fase 1 corrente, anche se compaiono in testi legacy.\n- Voice può essere descritta come inclusa ma non attiva finché configured=true e verified=true.\n- Non mostrare nomi di provider infrastrutturali, URL backend, chiavi, token, tenant ID o dettagli tecnici interni.\n- Rispondi in italiano, in modo concreto e normalmente entro 10 frasi.\n- Se l'utente chiede come fare qualcosa, fornisci passaggi numerati aderenti alle schermate ClerkAI.\n- Non inventare dati.\n\nRispondi esclusivamente con JSON valido: {"answer":"testo"}`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_CHAT_MODEL") || "gpt-5.4-mini",
        temperature: 0.15,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "system", content: `STATO ACCOUNT REALE\n${JSON.stringify(runtime)}\n\nFONTI UFFICIALI APPROVATE\n${sourceText}` },
          { role: "user", content: message },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("[app-assistant-message] provider status", aiResponse.status);
      return json({ answer: fallbackFromContext(ctx), links: [{ label: "Panoramica", href: "/app" }] }, 200, headers);
    }

    const payload = await aiResponse.json();
    const raw = payload?.choices?.[0]?.message?.content;
    let answer = "";
    try {
      const parsed = JSON.parse(raw || "{}");
      answer = clean(parsed.answer, 4000);
    } catch {
      answer = "";
    }
    if (!answer) answer = fallbackFromContext(ctx);

    return json({
      answer,
      links: [{ label: "Panoramica", href: "/app" }],
      context: { plan: ctx.planName, service_status: ctx.serviceStatus },
    }, 200, headers);
  } catch (error) {
    console.error("[app-assistant-message] failed", error);
    return json({ error: "Assistente temporaneamente non disponibile" }, 503, headers);
  }
});
