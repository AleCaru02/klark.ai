import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requiredEnv,
  requireUserTenant,
} from "../_shared/security.ts";

type TemplateType =
  | "confirmation"
  | "reminder"
  | "canceled"
  | "rescheduled"
  | "missed_call";

interface TemplateRequest {
  template_type?: unknown;
  body_text?: unknown;
}

const templateNames: Record<TemplateType, string> = {
  confirmation: "appointment_confirmation",
  reminder: "appointment_reminder",
  canceled: "appointment_canceled",
  rescheduled: "appointment_rescheduled",
  missed_call: "missed_call_notification",
};

function corsHeaders(request: Request): Record<string, string> {
  const appUrl = requiredEnv("APP_URL").replace(/\/$/, "");
  const extraOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const allowed = new Set([appUrl, ...extraOrigins]);
  const requestOrigin = request.headers.get("Origin")?.replace(/\/$/, "");

  return {
    "Access-Control-Allow-Origin": requestOrigin && allowed.has(requestOrigin)
      ? requestOrigin
      : appUrl,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function graphVersion(): string {
  const value = requiredEnv("META_GRAPH_API_VERSION");
  if (!/^v\d+\.\d+$/.test(value)) throw new Error("Invalid META_GRAPH_API_VERSION");
  return value;
}

function normalizeTemplateBody(value: unknown): string {
  if (typeof value !== "string") throw new AuthError("Invalid template body", 400);
  const body = value.trim();
  if (body.length < 10 || body.length > 1024) {
    throw new AuthError("Template body must contain between 10 and 1024 characters", 400);
  }

  const indexes = Array.from(body.matchAll(/\{\{(\d+)\}\}/g)).map((match) => Number(match[1]));
  const uniqueIndexes = [...new Set(indexes)].sort((a, b) => a - b);
  if (uniqueIndexes.some((index, position) => index !== position + 1)) {
    throw new AuthError("Template variables must be sequential starting from {{1}}", 400);
  }
  if (/\{\{[^\d}]/.test(body) || /\{(?!\{)|(?<!\})\}/.test(body)) {
    throw new AuthError("Invalid template variable syntax", 400);
  }

  return body;
}

function parseTemplateType(value: unknown): TemplateType {
  if (typeof value !== "string" || !(value in templateNames)) {
    throw new AuthError("Invalid template type", 400);
  }
  return value as TemplateType;
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, {
      ...headers,
      "Allow": "POST",
    });
  }

  try {
    const serviceClient = createServiceClient();
    const caller = await requireUserTenant(request, serviceClient);
    const payload = await request.json().catch(() => ({})) as TemplateRequest;
    const templateType = parseTemplateType(payload.template_type);
    const bodyText = normalizeTemplateBody(payload.body_text);

    const { data: integration, error: integrationError } = await serviceClient
      .from("whatsapp_integrations")
      .select("waba_id,access_token,token_expires_at")
      .eq("tenant_id", caller.tenantId)
      .maybeSingle();
    if (integrationError) throw integrationError;
    if (!integration?.waba_id || !integration.access_token) {
      throw new AuthError("WhatsApp Business is not connected", 409);
    }
    if (
      integration.token_expires_at &&
      new Date(integration.token_expires_at).getTime() <= Date.now() + 5 * 60 * 1000
    ) {
      throw new AuthError("WhatsApp authorization has expired", 409);
    }

    const templateName = `${templateNames[templateType]}_${caller.tenantId.slice(0, 8)}`;
    const metaResponse = await fetch(
      `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(integration.waba_id)}/message_templates`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${integration.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: templateName,
          language: "it",
          category: "UTILITY",
          components: [{ type: "BODY", text: bodyText }],
        }),
      },
    );
    const metaBody = await metaResponse.json().catch(() => ({})) as {
      id?: string;
      status?: string;
      error?: { code?: number; error_subcode?: number; message?: string };
    };

    if (!metaResponse.ok || !metaBody.id) {
      const rejectionCode = metaBody.error?.code ?? metaResponse.status;
      const rejectionReason = `Meta rejected the template (code ${rejectionCode})`;
      const { error: saveRejectionError } = await serviceClient
        .from("whatsapp_templates")
        .upsert(
          {
            tenant_id: caller.tenantId,
            template_name: templateName,
            template_type: templateType,
            body_text: bodyText,
            status: "rejected",
            rejection_reason: rejectionReason,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,template_type" },
        );
      if (saveRejectionError) console.error("Unable to persist rejected WhatsApp template");

      await serviceClient.from("audit_log").insert({
        tenant_id: caller.tenantId,
        actor_user_id: caller.userId,
        action: "whatsapp.template_rejected",
        payload_json: {
          template_type: templateType,
          provider_status: metaResponse.status,
          provider_error_code: metaBody.error?.code ?? null,
          provider_error_subcode: metaBody.error?.error_subcode ?? null,
        },
      });

      return jsonResponse(
        { error: "Meta did not accept the template", code: rejectionCode },
        422,
        headers,
      );
    }

    const status = typeof metaBody.status === "string"
      ? metaBody.status.toLowerCase()
      : "pending";
    const { data: savedTemplate, error: saveError } = await serviceClient
      .from("whatsapp_templates")
      .upsert(
        {
          tenant_id: caller.tenantId,
          template_name: templateName,
          template_type: templateType,
          body_text: bodyText,
          status,
          meta_template_id: metaBody.id,
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,template_type" },
      )
      .select("id,template_name,template_type,status")
      .maybeSingle();
    if (saveError) throw saveError;
    if (!savedTemplate) throw new Error("Template persistence failed");

    const { error: auditError } = await serviceClient.from("audit_log").insert({
      tenant_id: caller.tenantId,
      actor_user_id: caller.userId,
      action: "whatsapp.template_created",
      payload_json: {
        template_type: templateType,
        status,
      },
    });
    if (auditError) console.error("Unable to write WhatsApp template audit event");

    return jsonResponse(
      {
        success: true,
        template: savedTemplate,
      },
      201,
      headers,
    );
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error("whatsapp-create-template failed");
    return jsonResponse(
      {
        error: status < 500 && error instanceof Error
          ? error.message
          : "Unable to create WhatsApp template",
      },
      status,
      headers,
    );
  }
});
