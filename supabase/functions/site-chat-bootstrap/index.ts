import {
  createServiceClient,
  jsonResponse,
} from "../_shared/security.ts";
import {
  appOriginAllowed,
  getClientIp,
  hashIp,
  hashSessionToken,
  loadChatbot,
  normalizeOrigin,
  originAllowed,
  publicConfig,
  randomToken,
  siteChatCors,
} from "../_shared/site-chat.ts";

Deno.serve(async (request) => {
  const requestUrl = new URL(request.url);
  const widgetKey = requestUrl.searchParams.get("key")?.trim() || "";
  const requestOrigin = normalizeOrigin(request.headers.get("Origin"));
  const client = createServiceClient();

  try {
    const chatbot = await loadChatbot(client, widgetKey);
    const allowed = Boolean(
      requestOrigin &&
      chatbot &&
      (originAllowed(requestOrigin, chatbot.allowed_origins) || appOriginAllowed(requestOrigin)),
    );
    const headers = siteChatCors(requestOrigin, allowed);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: allowed ? 204 : 403, headers });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, { ...headers, Allow: "POST" });
    }
    if (!chatbot || !allowed || !requestOrigin) {
      return jsonResponse({ error: "Widget not available for this origin" }, 403, headers);
    }

    const ipHash = await hashIp(getClientIp(request));
    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count, error: limitError } = await client
      .from("site_chat_sessions")
      .select("id", { count: "exact", head: true })
      .eq("chatbot_id", chatbot.id)
      .eq("ip_hash", ipHash)
      .gte("created_at", windowStart);
    if (limitError) throw limitError;
    if ((count ?? 0) >= 10) {
      return jsonResponse({ error: "Too many sessions. Try again later." }, 429, {
        ...headers,
        "Retry-After": "900",
      });
    }

    const sessionToken = randomToken();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const userAgent = (request.headers.get("user-agent") || "").slice(0, 500);
    const { data: session, error: sessionError } = await client
      .from("site_chat_sessions")
      .insert({
        tenant_id: chatbot.tenant_id,
        chatbot_id: chatbot.id,
        session_token_hash: await hashSessionToken(sessionToken),
        origin: requestOrigin,
        ip_hash: ipHash,
        user_agent: userAgent || null,
        expires_at: expiresAt,
      })
      .select("id,expires_at")
      .single();
    if (sessionError) throw sessionError;

    await client.from("audit_log").insert({
      tenant_id: chatbot.tenant_id,
      actor_user_id: null,
      action: "site_chat.session_started",
      payload_json: {
        chatbot_id: chatbot.id,
        session_id: session.id,
        origin: requestOrigin,
      },
    });

    return jsonResponse({
      session_id: session.id,
      session_token: sessionToken,
      expires_at: session.expires_at,
      config: publicConfig(chatbot),
    }, 201, headers);
  } catch (error) {
    console.error("[site-chat-bootstrap] Failed", error);
    const headers = siteChatCors(requestOrigin, false);
    return jsonResponse({ error: "Chat service temporarily unavailable" }, 503, headers);
  }
});
