import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, sha256Hex } from "../_shared/security.ts";

const allowedOrigins = new Set([
  "https://www.clerkai.it",
  "https://clerkai.it",
  "https://clark-ai.lovable.app",
  "https://clerkai-preview-alecaru02.vercel.app",
]);

const allowedPlans = new Set(["essential", "growth", "pro", "enterprise"]);

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(origin: string, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function validPhone(value: string) {
  return !value || /^\+?[0-9() .-]{7,25}$/.test(value);
}

serve(async (request) => {
  const origin = request.headers.get("Origin") ?? "";
  if (!allowedOrigins.has(origin)) return new Response("Forbidden", { status: 403 });
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (request.method !== "POST") return json(origin, { error: "Method not allowed" }, 405);

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 20_000) return json(origin, { error: "Request too large" }, 413);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json(origin, { error: "Invalid request" }, 400);
  }

  if (clean(payload.website, 120)) return json(origin, { ok: true });

  const company = clean(payload.company, 160);
  const contactName = clean(payload.contactName, 120);
  const email = clean(payload.email, 254).toLowerCase();
  const phone = clean(payload.phone, 25);
  const sector = clean(payload.sector, 120);
  const callVolume = clean(payload.callVolume, 80);
  const mainGoal = clean(payload.mainGoal, 160);
  const notes = clean(payload.notes, 1500);
  const selectedPlanRaw = clean(payload.selectedPlan, 40);
  const selectedPlan = allowedPlans.has(selectedPlanRaw) ? selectedPlanRaw : null;
  const referralCode = clean(payload.referralCode, 80) || null;
  const existingNumber = typeof payload.existingNumber === "boolean" ? payload.existingNumber : null;
  const consent = payload.consent === true;

  if (company.length < 2 || contactName.length < 2 || sector.length < 2 || mainGoal.length < 2 || !validEmail(email) || !validPhone(phone) || !consent) {
    return json(origin, { error: "Controlla i campi obbligatori" }, 400);
  }

  const ip = (request.headers.get("x-forwarded-for") ?? request.headers.get("cf-connecting-ip") ?? "unknown").split(",")[0].trim();
  const userAgent = (request.headers.get("user-agent") ?? "unknown").slice(0, 220);
  const fingerprint = await sha256Hex(`${ip}|${userAgent}`);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const supabase = createServiceClient();

  const { count, error: rateError } = await supabase
    .from("demo_requests")
    .select("id", { count: "exact", head: true })
    .eq("request_fingerprint", fingerprint)
    .gte("created_at", since);
  if (rateError) throw rateError;
  if ((count ?? 0) >= 5) return json(origin, { error: "Troppe richieste. Riprova più tardi." }, 429);

  const { data, error } = await supabase
    .from("demo_requests")
    .insert({
      company,
      contact_name: contactName,
      email,
      phone: phone || null,
      sector,
      call_volume: callVolume || null,
      main_goal: mainGoal,
      existing_number: existingNumber,
      notes: notes || null,
      selected_plan: selectedPlan,
      referral_code: referralCode,
      consent: true,
      request_fingerprint: fingerprint,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[public-demo-request] insert failed", error.code);
    return json(origin, { error: "Impossibile registrare la richiesta" }, 500);
  }

  return json(origin, { ok: true, requestId: data.id }, 201);
});
