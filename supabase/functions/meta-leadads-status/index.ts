import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant_id from query params
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id");

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if Meta env vars are configured (global check)
    const metaAppId = Deno.env.get("FACEBOOK_APP_ID");
    const metaAppSecret = Deno.env.get("FACEBOOK_APP_SECRET");
    const envConfigured = !!(metaAppId && metaAppSecret);

    // Use service role for database operations
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if tenant has Facebook integration
    const { data: integration } = await supabaseAdmin
      .from("facebook_integrations")
      .select("page_id, form_id, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .single();

    // Get recent imports
    const { data: recentImports } = await supabaseAdmin
      .from("facebook_lead_imports")
      .select(`
        id,
        leadgen_id,
        form_id,
        imported_at,
        contacts(id, name, email, phone_e164)
      `)
      .eq("tenant_id", tenantId)
      .order("imported_at", { ascending: false })
      .limit(20);

    // Get import stats
    const { count: totalImports } = await supabaseAdmin
      .from("facebook_lead_imports")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    return new Response(
      JSON.stringify({
        env_configured: envConfigured,
        connected: !!integration,
        integration: integration
          ? {
              page_id: integration.page_id,
              form_id: integration.form_id,
              created_at: integration.created_at,
              updated_at: integration.updated_at,
            }
          : null,
        stats: {
          total_imports: totalImports || 0,
        },
        recent_imports: recentImports || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[meta-leadads-status] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
