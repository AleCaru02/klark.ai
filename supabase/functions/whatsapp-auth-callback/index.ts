import {
  createServiceClient,
  requiredEnv,
  sha256Hex,
} from "../_shared/security.ts";
import {
  exchangeMetaAuthorizationCode,
  metaGraphGet,
} from "../_shared/meta-oauth.ts";

interface MetaList<T> {
  data?: T[];
}

Deno.serve(async (request) => {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const url = new URL(request.url);
  const appUrl = (Deno.env.get("APP_URL") || "https://assistant-call-sync.lovable.app")
    .replace(/\/$/, "");
  const destination = `${appUrl}/app/whatsapp`;
  const supabase = createServiceClient();

  try {
    if (url.searchParams.get("error")) {
      return redirect(destination, { error: "oauth_denied" });
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return redirect(destination, { error: "invalid_callback" });

    const { data: rows, error: stateError } = await supabase.rpc(
      "consume_oauth_state",
      { p_provider: "whatsapp", p_state_hash: await sha256Hex(state) },
    );
    if (stateError) throw stateError;
    const oauthState = rows?.[0];
    if (!oauthState?.tenant_id || !oauthState?.user_id || !oauthState?.redirect_uri) {
      return redirect(destination, { error: "invalid_or_expired_state" });
    }

    const tenantId = oauthState.tenant_id as string;
    const userId = oauthState.user_id as string;
    const redirectUri = oauthState.redirect_uri as string;
    const expectedRedirectUri = `${requiredEnv("SUPABASE_URL")}/functions/v1/whatsapp-auth-callback`;
    if (redirectUri !== expectedRedirectUri) {
      return redirect(destination, { error: "redirect_mismatch" });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return redirect(destination, { error: "access_denied" });

    const token = await exchangeMetaAuthorizationCode(code, redirectUri);
    const businesses = await metaGraphGet<MetaList<{ id: string }>>(
      "me/businesses",
      token.accessToken,
      { fields: "id,name" },
    );
    const businessId = businesses.data?.[0]?.id;
    if (!businessId) return redirect(destination, { error: "no_business_found" });

    const wabas = await metaGraphGet<MetaList<{ id: string }>>(
      `${businessId}/owned_whatsapp_business_accounts`,
      token.accessToken,
      { fields: "id,name" },
    );
    const wabaId = wabas.data?.[0]?.id;
    if (!wabaId) return redirect(destination, { error: "no_waba_found" });

    const phones = await metaGraphGet<
      MetaList<{
        id: string;
        display_phone_number?: string;
        verified_name?: string;
      }>
    >(
      `${wabaId}/phone_numbers`,
      token.accessToken,
      { fields: "id,display_phone_number,verified_name" },
    );
    const phone = phones.data?.[0];
    if (!phone?.id) return redirect(destination, { error: "no_phone_number" });

    const tokenExpiresAt = new Date(
      Date.now() + token.expiresIn * 1000,
    ).toISOString();
    const { error: saveError } = await supabase
      .from("whatsapp_integrations")
      .upsert({
        tenant_id: tenantId,
        waba_id: wabaId,
        phone_number_id: phone.id,
        access_token: token.accessToken,
        display_phone_number: phone.display_phone_number || null,
        verified_name: phone.verified_name || null,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id" });
    if (saveError) throw saveError;

    const { error: auditError } = await supabase.from("audit_log").insert({
      tenant_id: tenantId,
      actor_user_id: userId,
      action: "whatsapp.oauth_connected",
      payload_json: {
        waba_id: wabaId,
        phone_number_id: phone.id,
        token_expires_at: tokenExpiresAt,
      },
    });
    if (auditError) console.error("[whatsapp-auth-callback] Audit failed", auditError);

    return redirect(destination, { success: "true" });
  } catch (error) {
    console.error("[whatsapp-auth-callback] Error", error);
    return redirect(destination, { error: "oauth_callback_failed" });
  }
});

function redirect(base: string, params: Record<string, string>): Response {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url.toString(), 302);
}
