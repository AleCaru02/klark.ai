import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  constantTimeEqual,
  createServiceClient,
  hmacHex,
  jsonResponse,
  markProviderEventFailed,
  markProviderEventProcessed,
  registerProviderEvent,
  requiredEnv,
  sha256Hex,
} from "../_shared/security.ts";

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
  }

  let providerEventId: string | undefined;
  const supabase = createServiceClient();

  try {
    let webhookSecret: string;
    try {
      webhookSecret = requiredEnv("STRIPE_WEBHOOK_SECRET");
    } catch (error) {
      console.error("[stripe-webhook] Webhook secret is not configured", error);
      return jsonResponse({ error: "Webhook unavailable" }, 503);
    }

    const signatureHeader = request.headers.get("stripe-signature");
    const rawBody = await request.text();
    if (!signatureHeader) return jsonResponse({ error: "Missing signature" }, 401);

    if (!(await verifyStripeSignature(rawBody, signatureHeader, webhookSecret))) {
      return jsonResponse({ error: "Invalid signature" }, 401);
    }

    let event: StripeEvent;
    try {
      event = JSON.parse(rawBody) as StripeEvent;
    } catch {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    if (!event.id || !event.type || !event.data?.object) {
      return jsonResponse({ error: "Incomplete event" }, 400);
    }

    const registration = await registerProviderEvent(
      supabase,
      "stripe",
      event.id,
      event.type,
      await sha256Hex(rawBody),
    );
    if (registration.duplicate) {
      return jsonResponse({ received: true, duplicate: true });
    }
    providerEventId = registration.id;

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(supabase, event.data.object);
          break;
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(supabase, event.data.object);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(supabase, event.data.object);
          break;
        case "invoice.paid":
          await handleInvoicePaid(supabase, event.data.object);
          break;
        case "invoice.payment_failed":
          await handlePaymentFailed(supabase, event.data.object);
          break;
        default:
          console.log(`[stripe-webhook] Ignored event type ${event.type}`);
      }

      await markProviderEventProcessed(supabase, providerEventId!);
      return jsonResponse({ received: true });
    } catch (error) {
      await markProviderEventFailed(
        supabase,
        providerEventId!,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  } catch (error) {
    console.error("[stripe-webhook] Processing failed", error);
    return jsonResponse({ error: "Webhook processing error" }, 500);
  }
});

async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  const timestamp = signatureHeader
    .split(",")
    .map((part) => part.trim().split("=", 2))
    .find(([key]) => key === "t")?.[1];
  const signatures = signatureHeader
    .split(",")
    .map((part) => part.trim().split("=", 2))
    .filter(([key, value]) => key === "v1" && Boolean(value))
    .map(([, value]) => value.toLowerCase());

  const timestampNumber = Number(timestamp);
  if (!timestamp || !Number.isFinite(timestampNumber) || signatures.length === 0) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampNumber) > toleranceSeconds) return false;

  const expected = await hmacHex("SHA-256", secret, `${timestamp}.${payload}`);
  return signatures.some((signature) => constantTimeEqual(signature, expected));
}

async function handleCheckoutCompleted(supabase: any, session: any) {
  const customerId = asString(session.customer);
  const subscriptionId = asString(session.subscription);
  const customerEmail = asString(
    session.customer_email ?? session.customer_details?.email,
  );
  const metadata = session.metadata ?? {};
  const planCode = asString(metadata.plan_code) || "combo_start";

  if (!customerId || !subscriptionId) {
    throw new Error("Checkout session is missing customer or subscription ID");
  }

  const { data: existingSubscription, error: existingError } = await supabase
    .from("subscriptions")
    .select("tenant_id")
    .or(
      `stripe_subscription_id.eq.${subscriptionId},stripe_customer_id.eq.${customerId}`,
    )
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  let tenantId = asString(metadata.tenant_id) || existingSubscription?.tenant_id;
  let createdTenantId: string | null = null;

  if (!tenantId) {
    const tenantName = asString(metadata.tenant_name) ||
      customerEmail?.split("@")[0] || "New Studio";
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({ name: tenantName, country: asString(metadata.country) || "IT" })
      .select("id")
      .single();
    if (tenantError) throw tenantError;
    tenantId = tenant.id;
    createdTenantId = tenant.id;
  }

  try {
    if (existingSubscription) {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan_code: planCode,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: "active",
        })
        .eq("tenant_id", tenantId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("subscriptions").insert({
        tenant_id: tenantId,
        plan_code: planCode,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: "active",
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (error) throw error;
    }

    const { error: settingsError } = await supabase
      .from("settings")
      .upsert({ tenant_id: tenantId }, { onConflict: "tenant_id", ignoreDuplicates: true });
    if (settingsError) console.error("Unable to initialize settings", settingsError);

    const { error: auditError } = await supabase.from("audit_log").insert({
      tenant_id: tenantId,
      action: "checkout.session.completed",
      payload_json: {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        plan_code: planCode,
      },
    });
    if (auditError) console.error("Unable to write checkout audit log", auditError);
  } catch (error) {
    if (createdTenantId) {
      const { error: compensationError } = await supabase
        .from("tenants")
        .delete()
        .eq("id", createdTenantId);
      if (compensationError) {
        console.error("Checkout compensation failed", compensationError);
      }
    }
    throw error;
  }
}

async function handleSubscriptionUpdated(supabase: any, subscription: any) {
  const subscriptionId = asString(subscription.id);
  if (!subscriptionId) throw new Error("Subscription ID is missing");

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: asString(subscription.status) || "active",
      period_start: unixToIso(subscription.current_period_start),
      period_end: unixToIso(subscription.current_period_end),
    })
    .eq("stripe_subscription_id", subscriptionId);
  if (error) throw error;
}

async function handleSubscriptionDeleted(supabase: any, subscription: any) {
  const subscriptionId = asString(subscription.id);
  if (!subscriptionId) throw new Error("Subscription ID is missing");

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("stripe_subscription_id", subscriptionId);
  if (error) throw error;
}

async function handleInvoicePaid(supabase: any, invoice: any) {
  const subscriptionId = asString(invoice.subscription);
  if (subscriptionId) {
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "active" })
      .eq("stripe_subscription_id", subscriptionId)
      .eq("status", "past_due");
    if (error) throw error;
  }
  await logInvoiceAudit(supabase, invoice, "invoice.paid");
}

async function handlePaymentFailed(supabase: any, invoice: any) {
  const subscriptionId = asString(invoice.subscription);
  if (subscriptionId) {
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "past_due" })
      .eq("stripe_subscription_id", subscriptionId);
    if (error) throw error;
  }
  await logInvoiceAudit(supabase, invoice, "invoice.payment_failed");
}

async function logInvoiceAudit(
  supabase: any,
  invoice: any,
  action: string,
) {
  const customerId = asString(invoice.customer);
  if (!customerId) return;

  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("tenant_id")
    .eq("stripe_customer_id", customerId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!subscription?.tenant_id) return;

  const { error: auditError } = await supabase.from("audit_log").insert({
    tenant_id: subscription.tenant_id,
    action,
    payload_json: {
      invoice_id: invoice.id,
      amount_paid: invoice.amount_paid,
      amount_due: invoice.amount_due,
      currency: invoice.currency,
      attempt_count: invoice.attempt_count,
    },
  });
  if (auditError) throw auditError;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function unixToIso(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}
