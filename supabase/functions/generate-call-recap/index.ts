import {
  AuthError,
  constantTimeEqual,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireUserTenant,
} from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type NextStep =
  | "appuntamento fissato"
  | "cliente confermato"
  | "richiamare"
  | "non interessato"
  | "altro";

type Priority = "alta" | "media" | "bassa";

interface CallRecapResult {
  summary_bullets: string[];
  next_step: NextStep;
  objections: string;
  priority: Priority;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, {
      ...corsHeaders,
      Allow: "POST",
    });
  }

  const supabase = createServiceClient();

  try {
    const body = await request.json() as {
      tenant_id?: string;
      contact_id?: string;
      call_log_id?: string;
      call_sid?: string;
      call_notes?: string;
      transcript?: string;
      regenerate?: boolean;
    };
    if (!body.tenant_id || !body.contact_id) {
      return jsonResponse(
        { error: "tenant_id and contact_id are required" },
        400,
        corsHeaders,
      );
    }

    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const suppliedToken = (request.headers.get("Authorization") ?? "")
      .replace(/^Bearer\s+/i, "");
    const isServiceCall = suppliedToken.length > 0 &&
      constantTimeEqual(suppliedToken, serviceRoleKey);
    let actorUserId: string | null = null;

    if (!isServiceCall) {
      const caller = await requireUserTenant(request, supabase);
      if (caller.tenantId !== body.tenant_id) {
        throw new AuthError("Cross-tenant recap denied", 403);
      }
      actorUserId = caller.userId;
    }

    const [{ data: settings, error: settingsError }, { data: contact, error: contactError }] =
      await Promise.all([
        supabase
          .from("settings")
          .select("ai_data_processing_opt_in")
          .eq("tenant_id", body.tenant_id)
          .maybeSingle(),
        supabase
          .from("contacts")
          .select("id,name")
          .eq("tenant_id", body.tenant_id)
          .eq("id", body.contact_id)
          .maybeSingle(),
      ]);
    if (settingsError) throw settingsError;
    if (contactError) throw contactError;
    if (!contact) throw new AuthError("Contact not found in tenant", 404);
    if (settings?.ai_data_processing_opt_in !== true) {
      return jsonResponse({ error: "AI data processing is not enabled" }, 409, corsHeaders);
    }

    let callLog: Record<string, unknown> | null = null;
    if (body.call_log_id) {
      const { data, error } = await supabase
        .from("call_logs")
        .select("id,transcript,twilio_call_sid")
        .eq("tenant_id", body.tenant_id)
        .eq("contact_id", body.contact_id)
        .eq("id", body.call_log_id)
        .maybeSingle();
      if (error) throw error;
      callLog = data;
    } else if (body.call_sid) {
      const { data, error } = await supabase
        .from("call_logs")
        .select("id,transcript,twilio_call_sid")
        .eq("tenant_id", body.tenant_id)
        .eq("contact_id", body.contact_id)
        .eq("twilio_call_sid", body.call_sid)
        .maybeSingle();
      if (error) throw error;
      callLog = data;
    }

    const [{ data: notes, error: notesError }, { data: formAnswers, error: formError }] =
      await Promise.all([
        supabase
          .from("lead_notes")
          .select("note_text")
          .eq("tenant_id", body.tenant_id)
          .eq("contact_id", body.contact_id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("lead_form_answers")
          .select("answers_json")
          .eq("tenant_id", body.tenant_id)
          .eq("contact_id", body.contact_id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
    if (notesError) throw notesError;
    if (formError) throw formError;

    const callInput = firstNonEmpty(
      body.transcript,
      typeof callLog?.transcript === "string" ? callLog.transcript : null,
      body.call_notes,
    )?.slice(0, 40_000);
    if (!callInput) {
      return jsonResponse({ error: "No call transcript or notes available" }, 400, corsHeaders);
    }

    const context = {
      contact_name: String(contact.name ?? "Contatto").slice(0, 160),
      form_answers: isRecord(formAnswers?.[0]?.answers_json)
        ? formAnswers[0].answers_json
        : {},
      previous_notes: (notes ?? [])
        .map((row: any) => String(row.note_text ?? "").slice(0, 1000))
        .filter(Boolean),
      call_transcript: callInput,
    };

    const recap = await generateRecap(context);
    if (body.regenerate) {
      let deletion = supabase
        .from("lead_call_recaps")
        .delete()
        .eq("tenant_id", body.tenant_id)
        .eq("contact_id", body.contact_id);
      if (callLog?.id) deletion = deletion.eq("call_log_id", callLog.id);
      const { error: deletionError } = await deletion;
      if (deletionError) throw deletionError;
    }

    const { data: savedRecap, error: recapError } = await supabase
      .from("lead_call_recaps")
      .insert({
        tenant_id: body.tenant_id,
        contact_id: body.contact_id,
        call_log_id: callLog?.id ?? null,
        summary_bullets_json: recap.summary_bullets,
        next_step: recap.next_step,
        objections: recap.objections,
        priority: recap.priority,
        raw_input: callInput.slice(0, 40_000),
      })
      .select("id,summary_bullets_json,next_step,objections,priority,created_at")
      .single();
    if (recapError) throw recapError;

    const now = new Date().toISOString();
    const [{ error: contactUpdateError }, { error: auditError }] = await Promise.all([
      supabase
        .from("contacts")
        .update({ last_activity_at: now })
        .eq("tenant_id", body.tenant_id)
        .eq("id", body.contact_id),
      supabase.from("audit_log").insert({
        tenant_id: body.tenant_id,
        actor_user_id: actorUserId,
        action: "call_recap.generated",
        payload_json: {
          recap_id: savedRecap.id,
          call_log_id: callLog?.id ?? null,
          source: body.transcript
            ? "provided_transcript"
            : callLog?.transcript
            ? "call_log"
            : "call_notes",
        },
      }),
    ]);
    if (contactUpdateError) throw contactUpdateError;
    if (auditError) console.error("[generate-call-recap] Audit failed", auditError);

    return jsonResponse({ success: true, recap: savedRecap }, 201, corsHeaders);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    console.error("[generate-call-recap] Processing failed", error);
    return jsonResponse(
      {
        error: status < 500 && error instanceof Error
          ? error.message
          : "Call recap generation failed",
      },
      status,
      corsHeaders,
    );
  }
});

async function generateRecap(context: Record<string, unknown>): Promise<CallRecapResult> {
  const apiKey = requiredEnv("LOVABLE_API_KEY");
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Analizza una chiamata commerciale. Non inventare dati. Produci 3-5 punti sintetici, il prossimo passo, eventuali obiezioni e la priorità.",
        },
        { role: "user", content: JSON.stringify(context).slice(0, 50_000) },
      ],
      tools: [{
        type: "function",
        function: {
          name: "generate_call_recap",
          parameters: {
            type: "object",
            properties: {
              summary_bullets: {
                type: "array",
                minItems: 1,
                maxItems: 5,
                items: { type: "string", maxLength: 200 },
              },
              next_step: {
                type: "string",
                enum: [
                  "appuntamento fissato",
                  "cliente confermato",
                  "richiamare",
                  "non interessato",
                  "altro",
                ],
              },
              objections: { type: "string", maxLength: 1000 },
              priority: { type: "string", enum: ["alta", "media", "bassa"] },
            },
            required: ["summary_bullets", "next_step", "objections", "priority"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "generate_call_recap" } },
      temperature: 0.2,
    }),
  });
  if (!response.ok) throw new Error(`AI provider error ${response.status}`);

  const data = await response.json() as any;
  const rawArguments = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (typeof rawArguments !== "string") throw new Error("AI returned no structured recap");
  return validateRecap(JSON.parse(rawArguments));
}

function validateRecap(value: unknown): CallRecapResult {
  if (!isRecord(value)) throw new Error("Invalid recap structure");
  const allowedNext = new Set<NextStep>([
    "appuntamento fissato",
    "cliente confermato",
    "richiamare",
    "non interessato",
    "altro",
  ]);
  const allowedPriorities = new Set<Priority>(["alta", "media", "bassa"]);
  const bullets = Array.isArray(value.summary_bullets)
    ? value.summary_bullets
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, 5)
      .map((item) => item.trim().slice(0, 200))
    : [];
  if (!bullets.length || !allowedNext.has(value.next_step as NextStep) ||
    !allowedPriorities.has(value.priority as Priority)) {
    throw new Error("Invalid recap values");
  }
  return {
    summary_bullets: bullets,
    next_step: value.next_step as NextStep,
    objections: typeof value.objections === "string"
      ? value.objections.trim().slice(0, 1000)
      : "",
    priority: value.priority as Priority,
  };
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
