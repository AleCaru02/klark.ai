import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * voice-audio-url
 *
 * Restituisce una signed URL breve (5 minuti) per un file del bucket privato
 * `voice-audio`, SOLO a un utente autenticato che appartiene al tenant
 * proprietario della chiamata associata al file.
 *
 * Il bucket è privato: nessun accesso pubblico agli audio delle chiamate.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const path = typeof body?.path === "string" ? body.path : "";
    if (!path || path.includes("..") || path.startsWith("/")) {
      return new Response(JSON.stringify({ error: "Invalid path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Tenant dell'utente (server-side, mai dal client)
    const { data: membership } = await admin
      .from("memberships")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership?.tenant_id) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // I file sono nominati voice-responses/[greeting-]<callSid>-<ts>.mp3.
    // Verifichiamo che il call SID appartenga al tenant dell'utente.
    const fileName = path.split("/").pop() ?? "";
    const sidMatch = fileName.match(/(CA[0-9a-fA-F]{32})/);
    if (!sidMatch) {
      return new Response(JSON.stringify({ error: "Unrecognized audio file" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callLog } = await admin
      .from("call_logs")
      .select("tenant_id")
      .eq("twilio_call_sid", sidMatch[1])
      .maybeSingle();

    if (!callLog || callLog.tenant_id !== membership.tenant_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signed, error: signError } = await admin.storage
      .from("voice-audio")
      .createSignedUrl(path, 300);

    if (signError || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: "Could not sign URL" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ url: signed.signedUrl, expires_in: 300 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[voice-audio-url] Error:", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
