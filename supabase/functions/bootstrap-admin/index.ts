import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  constantTimeEqual,
  createServiceClient,
  jsonResponse,
  requiredEnv,
} from "../_shared/security.ts";

function corsHeaders(request: Request): Record<string, string> {
  const appUrl = requiredEnv("APP_URL").replace(/\/$/, "");
  const allowed = new Set([appUrl, ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim().replace(/\/$/, "")).filter(Boolean)]);
  const origin = request.headers.get("Origin")?.replace(/\/$/, "");
  return {
    "Access-Control-Allow-Origin": origin && allowed.has(origin) ? origin : appUrl,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (request) => {
  let headers: Record<string, string>;
  try {
    headers = corsHeaders(request);
  } catch {
    return jsonResponse({ error: "Bootstrap unavailable" }, 503);
  }
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, { ...headers, Allow: "POST" });

  let expectedSecret: string;
  try {
    expectedSecret = requiredEnv("BOOTSTRAP_SECRET");
  } catch {
    return jsonResponse({ error: "Bootstrap unavailable" }, 503, headers);
  }
  const suppliedSecret = request.headers.get("x-bootstrap-secret") ?? "";
  if (!suppliedSecret || !constantTimeEqual(suppliedSecret, expectedSecret)) {
    return jsonResponse({ error: "Unauthorized" }, 401, headers);
  }

  const client = createServiceClient();
  let createdUserId: string | null = null;
  let createdTenantId: string | null = null;

  try {
    const { data: existingAdmin, error: adminCheckError } = await client
      .from("platform_admins").select("user_id").limit(1).maybeSingle();
    if (adminCheckError) throw adminCheckError;
    if (existingAdmin) return jsonResponse({ error: "Bootstrap already completed" }, 409, headers);

    const body = await request.json().catch(() => ({})) as { email?: unknown; password?: unknown; full_name?: unknown };
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const fullName = typeof body.full_name === "string" ? body.full_name.trim().slice(0, 120) : "Platform Admin";
    if (!email || password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return jsonResponse({ error: "Valid email and a strong password of at least 12 characters are required" }, 400, headers);
    }

    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || "Platform Admin", must_change_password: true },
    });
    if (authError || !authData.user) return jsonResponse({ error: "Unable to create administrator" }, 400, headers);
    createdUserId = authData.user.id;

    const { data: tenant, error: tenantError } = await client
      .from("tenants").insert({ name: "Platform Administration", country: "IT" }).select("id").single();
    if (tenantError) throw tenantError;
    createdTenantId = tenant.id;

    const operations = await Promise.all([
      client.from("memberships").insert({ user_id: createdUserId, tenant_id: createdTenantId, role: "admin" }),
      client.from("platform_admins").insert({ user_id: createdUserId, created_by: createdUserId }),
      client.from("settings").insert({ tenant_id: createdTenantId }),
    ]);
    const operationError = operations.find((result) => result.error)?.error;
    if (operationError) throw operationError;

    const { error: auditError } = await client.from("audit_log").insert({
      tenant_id: createdTenantId,
      actor_user_id: createdUserId,
      action: "platform_admin.bootstrap_completed",
      payload_json: { bootstrap_version: 1 },
    });
    if (auditError) throw auditError;

    return jsonResponse({ success: true }, 201, headers);
  } catch {
    console.error("bootstrap-admin failed");
    if (createdTenantId) await client.from("tenants").delete().eq("id", createdTenantId);
    if (createdUserId) await client.auth.admin.deleteUser(createdUserId);
    return jsonResponse({ error: "Bootstrap failed" }, 500, headers);
  }
});

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}
