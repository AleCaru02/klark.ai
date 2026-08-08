import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requireUserTenant,
} from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, {
      ...corsHeaders,
      Allow: "POST",
    });
  }

  const supabase = createServiceClient();
  let createdUserId: string | null = null;
  let createdTenantId: string | null = null;
  let createdNewUser = false;

  try {
    const caller = await requireUserTenant(request, supabase);
    const { data: platformAdmin, error: adminError } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", caller.userId)
      .maybeSingle();
    if (adminError) throw adminError;
    if (!platformAdmin) throw new AuthError("Platform admin access required", 403);

    const body = await request.json() as {
      email?: string;
      studio_name?: string;
      plan_code?: string;
      password?: string;
      send_email?: boolean;
    };
    const email = normalizeEmail(body.email);
    const studioName = body.studio_name?.trim().slice(0, 160) || "";
    const planCode = body.plan_code?.trim() || "essential";
    const password = body.password || "";
    const sendEmail = body.send_email !== false;

    if (!email || !studioName) {
      return jsonResponse(
        { error: "A valid email and studio_name are required" },
        400,
        corsHeaders,
      );
    }
    if (password && password.length < 12) {
      return jsonResponse(
        { error: "Password must contain at least 12 characters" },
        400,
        corsHeaders,
      );
    }

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("code")
      .eq("code", planCode)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan) return jsonResponse({ error: "Unknown plan_code" }, 400, corsHeaders);

    const { data: userPage, error: usersError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersError) throw usersError;
    const existingUser = userPage.users.find(
      (user) => user.email?.toLowerCase() === email,
    );

    if (existingUser) {
      const { data: existingMembership, error: membershipLookupError } = await supabase
        .from("memberships")
        .select("id")
        .eq("user_id", existingUser.id)
        .maybeSingle();
      if (membershipLookupError) throw membershipLookupError;
      if (existingMembership) {
        return jsonResponse({ error: "User already belongs to a tenant" }, 409, corsHeaders);
      }
      createdUserId = existingUser.id;
    } else {
      const initialPassword = password || randomPassword();
      const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          full_name: studioName,
          must_change_password: true,
        },
      });
      if (authError || !newUser.user) {
        return jsonResponse(
          { error: authError?.message || "Unable to create user" },
          400,
          corsHeaders,
        );
      }
      createdUserId = newUser.user.id;
      createdNewUser = true;
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({ name: studioName, country: "IT" })
      .select("id")
      .single();
    if (tenantError) throw tenantError;
    createdTenantId = tenant.id;

    const operations = await Promise.all([
      supabase.from("memberships").insert({
        user_id: createdUserId,
        tenant_id: createdTenantId,
        role: "customer",
      }),
      supabase.from("tenant_service_accounts").insert({
        tenant_id: createdTenantId,
        plan_code: planCode,
        status: "pending",
        updated_by: caller.userId,
      }),
      supabase.from("settings").insert({
        tenant_id: createdTenantId,
        ai_prompt_json: {
          onboarding_step: 1,
          production_readiness_approved: false,
          e2e_verified: false,
        },
      }),
    ]);
    const operationError = operations.find((result) => result.error)?.error;
    if (operationError) throw operationError;

    const { error: auditError } = await supabase.from("audit_log").insert({
      tenant_id: createdTenantId,
      actor_user_id: caller.userId,
      action: "tenant_user.created_by_platform_admin",
      payload_json: {
        user_id: createdUserId,
        plan_code: planCode,
        existing_auth_user: !createdNewUser,
        service_status: "pending",
        billing_mode: "manual_external",
        production_ready: false,
      },
    });
    if (auditError) throw auditError;

    let emailSent = false;
    if (sendEmail) {
      emailSent = await sendWelcomeEmail(supabase, email, studioName);
    }

    return jsonResponse(
      {
        success: true,
        user_id: createdUserId,
        tenant_id: createdTenantId,
        email_sent: emailSent,
        existing_auth_user: !createdNewUser,
        password_was_emailed: false,
        production_ready: false,
        service_status: "pending",
      },
      201,
      corsHeaders,
    );
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    console.error("[create-user] Creation failed", error);

    if (createdTenantId) {
      const { error: tenantCleanupError } = await supabase
        .from("tenants")
        .delete()
        .eq("id", createdTenantId);
      if (tenantCleanupError) {
        console.error("[create-user] Tenant cleanup failed", tenantCleanupError);
      }
    }
    if (createdNewUser && createdUserId) {
      const { error: userCleanupError } = await supabase.auth.admin.deleteUser(
        createdUserId,
      );
      if (userCleanupError) {
        console.error("[create-user] User cleanup failed", userCleanupError);
      }
    }

    return jsonResponse(
      { error: status < 500 && error instanceof Error ? error.message : "User creation failed" },
      status,
      corsHeaders,
    );
  }
});

async function sendWelcomeEmail(
  supabase: any,
  email: string,
  studioName: string,
): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const resendFrom = Deno.env.get("RESEND_FROM")?.trim();
  if (!resendKey || !resendFrom) return false;

  const appUrl = (
    Deno.env.get("PUBLIC_APP_URL") ||
    Deno.env.get("APP_URL") ||
    "https://clark-ai.lovable.app"
  ).replace(/\/$/, "");
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${appUrl}/reset-password` },
  });
  if (linkError || !linkData?.properties?.action_link) {
    console.error("[create-user] Password setup link generation failed", linkError);
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [email],
      subject: "Configura il tuo accesso a ClerkAI",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
          <h1>Accesso a ClerkAI</h1>
          <p>È stato creato l'account per ${escapeHtml(studioName)}.</p>
          <p>Usa il pulsante seguente per impostare personalmente la password. La password non viene inviata o conservata nelle email.</p>
          <p><a href="${escapeHtml(linkData.properties.action_link)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Imposta la password</a></p>
          <p>Il link è personale e deve essere utilizzato solo dal destinatario.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    console.error("[create-user] Welcome email rejected", response.status);
    return false;
  }
  return true;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}
