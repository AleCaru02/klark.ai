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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendRequest {
  to?: string | null;
  template_name: string;
  language?: string;
  parameters?: string[];
  tenant_id: string;
  contact_id?: string;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { ...corsHeaders, Allow: "POST" });
  }

  try {
    const supabase = createServiceClient();
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const suppliedToken = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const isServiceCall = suppliedToken.length > 0 && constantTimeEqual(suppliedToken, serviceRoleKey);
    const body = await request.json() as SendRequest;

    if (!body.tenant_id || !body.template_name) {
      return jsonResponse(
        { error: "tenant_id and template_name are required" },
        400,
        corsHeaders,
      );
    }

    if (!isServiceCall) {
      const context = await requireUserTenant(request, supabase);
      if (context.tenantId !== body.tenant_id) {
        throw new AuthError("Cross-tenant message denied", 403);
      }
    }

    let destination = body.to || null;
    if (body.contact_id) {
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select("id,phone_e164")
        .eq("id", body.contact_id)
        .eq("tenant_id", body.tenant_id)
        .maybeSingle();
      if (contactError) throw contactError;
      if (!contact) throw new AuthError("Contact does not belong to tenant", 403);
      destination ||= contact.phone_e164 as string | null;
    }

    if (!destination) {
      return jsonResponse({ error: "Destination number is required" }, 400, corsHeaders);
    }

    const { data: integration, error: integrationError } = await supabase
      .from("whatsapp_integrations")
      .select("access_token,phone_number_id")
      .eq("tenant_id", body.tenant_id)
      .maybeSingle();
    if (integrationError) throw integrationError;
    if (!integration?.access_token || !integration?.phone_number_id) {
      return jsonResponse({ error: "WhatsApp is not configured for this tenant" }, 503, corsHeaders);
    }

    const parameters = Array.isArray(body.parameters)
      ? body.parameters.map((value) => String(value).slice(0, 1024))
      : [];
    const toNumber = normalizePhone(destination);
    if (!toNumber) return jsonResponse({ error: "Invalid destination number" }, 400, corsHeaders);

    const templateRequest: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: toNumber,
      type: "template",
      template: {
        name: body.template_name,
        language: { code: body.language || "it" },
        ...(parameters.length > 0
          ? {
              components: [{
                type: "body",
                parameters: parameters.map((text) => ({ type: "text", text })),
              }],
            }
          : {}),
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${integration.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${integration.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(templateRequest),
      },
    );
    const responseData = await response.json() as any;
    const messageId = responseData.messages?.[0]?.id as string | undefined;

    const { error: logError } = await supabase.from("message_logs").insert({
      tenant_id: body.tenant_id,
      contact_id: body.contact_id || null,
      channel: "whatsapp",
      template_name: body.template_name,
      status: response.ok ? "sent" : "failed",
      provider_message_id: messageId || null,
      payload_json: response.ok
        ? { to: toNumber, parameters_count: parameters.length }
        : {
            to: toNumber,
            error_code: responseData.error?.code,
            error_type: responseData.error?.type,
          },
    });
    if (logError) console.error("[send-whatsapp] Unable to write message log", logError);

    if (!response.ok) {
      console.error("[send-whatsapp] Provider rejected message", response.status, responseData.error);
      return jsonResponse({ success: false, error: "WhatsApp provider rejected message" }, 502, corsHeaders);
    }

    return jsonResponse({
      success: true,
      message_id: messageId,
      to: toNumber,
      template: body.template_name,
    }, 200, corsHeaders);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    console.error("[send-whatsapp] Error", error);
    return jsonResponse(
      { error: status < 500 && error instanceof Error ? error.message : "Message delivery failed" },
      status,
      corsHeaders,
    );
  }
});

function normalizePhone(value: string): string | null {
  const normalized = value.replace(/[^0-9]/g, "");
  return normalized.length >= 8 && normalized.length <= 15 ? normalized : null;
}
