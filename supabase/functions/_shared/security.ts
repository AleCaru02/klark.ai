import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import {
  constantTimeEqual,
  hmacBase64,
  hmacHex,
  sha256Hex,
  verifyMetaSignature,
  verifyTwilioFormSignature,
} from "./crypto.ts";

export {
  constantTimeEqual,
  hmacBase64,
  hmacHex,
  sha256Hex,
  verifyMetaSignature,
  verifyTwilioFormSignature,
};

export type ServiceClient = SupabaseClient<any>;

export interface UserTenantContext {
  userId: string;
  tenantId: string;
  accessToken: string;
}

export interface ProviderEventRegistration {
  duplicate: boolean;
  id?: string;
}

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function createServiceClient(): ServiceClient {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export async function requireUserTenant(
  request: Request,
  serviceClient = createServiceClient(),
): Promise<UserTenantContext> {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new AuthError("Missing bearer token", 401);

  const accessToken = match[1];
  const { data: userData, error: userError } = await serviceClient.auth.getUser(
    accessToken,
  );
  const userId = userData.user?.id;
  if (userError || !userId) throw new AuthError("Invalid bearer token", 401);

  const { data: membership, error: membershipError } = await serviceClient
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;

  let tenantId = membership?.tenant_id as string | undefined;
  if (!tenantId) {
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    tenantId = profile?.tenant_id as string | undefined;
  }

  if (!tenantId) throw new AuthError("User has no tenant", 403);
  return { userId, tenantId, accessToken };
}

export function requireServiceRole(request: Request): void {
  const expected = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supplied = (request.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!supplied || !constantTimeEqual(supplied, expected)) {
    throw new AuthError("Unauthorized", 401);
  }
}

export interface TenantServiceAccount {
  tenantId: string;
  planCode: string;
  status: "pending" | "active" | "suspended" | "cancelled";
  activatedAt: string | null;
  serviceEndAt: string | null;
}

export async function requireActiveTenant(
  client: ServiceClient,
  tenantId: string,
): Promise<TenantServiceAccount> {
  if (!tenantId) throw new AuthError("Tenant ID is required", 400);

  const { data, error } = await client
    .from("tenant_service_accounts")
    .select("tenant_id,plan_code,status,activated_at,service_end_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AuthError("Tenant service account is not configured", 403);

  const serviceEndAt = data.service_end_at as string | null;
  const expired = serviceEndAt ? new Date(serviceEndAt).getTime() <= Date.now() : false;
  if (data.status !== "active" || expired) {
    throw new AuthError("Tenant service is not active", 403);
  }

  return {
    tenantId: data.tenant_id as string,
    planCode: data.plan_code as string,
    status: data.status as TenantServiceAccount["status"],
    activatedAt: data.activated_at as string | null,
    serviceEndAt,
  };
}

export async function registerProviderEvent(
  client: ServiceClient,
  provider: string,
  externalEventId: string,
  eventType: string | null,
  payloadDigest: string,
  tenantId: string | null = null,
): Promise<ProviderEventRegistration> {
  if (!externalEventId) throw new Error("Provider event ID is required");

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("provider_events")
    .insert({
      provider,
      external_event_id: externalEventId,
      tenant_id: tenantId,
      event_type: eventType,
      status: "processing",
      payload_digest: payloadDigest,
      attempts: 1,
      locked_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (!error) return { duplicate: false, id: data.id as string };
  if (error.code !== "23505") throw error;

  const { data: existing, error: existingError } = await client
    .from("provider_events")
    .select("id,status,payload_digest,attempts")
    .eq("provider", provider)
    .eq("external_event_id", externalEventId)
    .single();
  if (existingError) throw existingError;

  if (
    existing.payload_digest &&
    !constantTimeEqual(existing.payload_digest as string, payloadDigest)
  ) {
    throw new Error("Provider event payload digest mismatch");
  }

  if (existing.status !== "failed") return { duplicate: true };

  const { data: reclaimed, error: reclaimError } = await client
    .from("provider_events")
    .update({
      status: "processing",
      attempts: Number(existing.attempts ?? 0) + 1,
      locked_at: now,
      updated_at: now,
      last_error_code: null,
    })
    .eq("id", existing.id)
    .eq("status", "failed")
    .select("id")
    .maybeSingle();
  if (reclaimError) throw reclaimError;

  return reclaimed?.id
    ? { duplicate: false, id: reclaimed.id as string }
    : { duplicate: true };
}

export async function markProviderEventProcessed(
  client: ServiceClient,
  eventId: string,
): Promise<void> {
  const { error } = await client
    .from("provider_events")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      locked_at: null,
      updated_at: new Date().toISOString(),
      last_error_code: null,
    })
    .eq("id", eventId);
  if (error) throw error;
}

export async function markProviderEventFailed(
  client: ServiceClient,
  eventId: string,
  errorCode: string,
): Promise<void> {
  const { error } = await client
    .from("provider_events")
    .update({
      status: "failed",
      locked_at: null,
      updated_at: new Date().toISOString(),
      last_error_code: errorCode.slice(0, 250),
    })
    .eq("id", eventId);
  if (error) console.error("Unable to mark provider event failed", error);
}

export class AuthError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AuthError";
  }
}
