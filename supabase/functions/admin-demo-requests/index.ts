import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AuthError, createServiceClient, jsonResponse } from "../_shared/security.ts";

const allowedStatuses = new Set(["new", "contacted", "qualified", "closed"]);

async function requirePlatformAdmin(request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new AuthError("Missing bearer token", 401);

  const supabase = createServiceClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(match[1]);
  const userId = userData.user?.id;
  if (userError || !userId) throw new AuthError("Invalid bearer token", 401);

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_platform_admin", { _user_id: userId });
  if (adminError) throw adminError;
  if (isAdmin !== true) throw new AuthError("Forbidden", 403);

  return { supabase, userId };
}

serve(async (request) => {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { supabase } = await requirePlatformAdmin(request);
    const payload = await request.json().catch(() => ({}));
    const action = typeof payload.action === "string" ? payload.action : "list";

    if (action === "list") {
      const status = typeof payload.status === "string" && allowedStatuses.has(payload.status) ? payload.status : null;
      const limit = Math.min(Math.max(Number(payload.limit) || 100, 1), 200);
      let query = supabase
        .from("demo_requests")
        .select("id,company,contact_name,email,phone,sector,call_volume,main_goal,existing_number,notes,selected_plan,referral_code,source,consent,status,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse({ requests: data ?? [] });
    }

    if (action === "update-status") {
      const id = typeof payload.id === "string" ? payload.id.trim() : "";
      const status = typeof payload.status === "string" ? payload.status : "";
      if (!/^[0-9a-f-]{36}$/i.test(id) || !allowedStatuses.has(status)) return jsonResponse({ error: "Invalid update" }, 400);

      const { data, error } = await supabase
        .from("demo_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id,status,updated_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: "Request not found" }, 404);
      return jsonResponse({ request: data });
    }

    return jsonResponse({ error: "Unsupported action" }, 400);
  } catch (error) {
    if (error instanceof AuthError) return jsonResponse({ error: error.message }, error.status);
    console.error("[admin-demo-requests] request failed");
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
