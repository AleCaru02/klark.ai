import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  constantTimeEqual,
  createServiceClient,
  jsonResponse,
  markProviderEventFailed,
  markProviderEventProcessed,
  registerProviderEvent,
  requiredEnv,
  sha256Hex,
} from "../_shared/security.ts";

serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
  }

  const channelId = request.headers.get("x-goog-channel-id") ?? "";
  const channelToken = request.headers.get("x-goog-channel-token") ?? "";
  const resourceId = request.headers.get("x-goog-resource-id") ?? "";
  const resourceState = request.headers.get("x-goog-resource-state") ?? "";
  const messageNumber = request.headers.get("x-goog-message-number") ?? "0";

  if (!channelId || !channelToken || !resourceState) {
    return jsonResponse({ error: "Missing Google channel headers" }, 400);
  }

  const supabase = createServiceClient();
  let providerEventId: string | undefined;

  try {
    const tokenHash = await sha256Hex(channelToken);
    const { data: channel, error: channelError } = await supabase
      .from("google_watch_channels")
      .select("tenant_id,resource_id,expires_at,active")
      .eq("channel_id", channelId)
      .eq("token_hash", tokenHash)
      .eq("active", true)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (channelError) throw channelError;
    if (!channel?.tenant_id) return jsonResponse({ error: "Unknown channel" }, 401);

    if (
      channel.resource_id &&
      resourceId &&
      !constantTimeEqual(channel.resource_id as string, resourceId)
    ) {
      return jsonResponse({ error: "Resource mismatch" }, 401);
    }

    const externalEventId = `${channelId}:${messageNumber}:${resourceState}`;
    const registration = await registerProviderEvent(
      supabase,
      "google_calendar",
      externalEventId,
      `watch.${resourceState}`,
      await sha256Hex(`${channelId}:${resourceId}:${resourceState}:${messageNumber}`),
      channel.tenant_id as string,
    );
    if (registration.duplicate) {
      return jsonResponse({ received: true, duplicate: true });
    }
    providerEventId = registration.id;

    try {
      if (resourceState === "sync") {
        await markProviderEventProcessed(supabase, providerEventId!);
        return jsonResponse({ received: true, sync_acknowledged: true });
      }

      if (resourceState === "not_exists") {
        const { error: deactivateError } = await supabase
          .from("google_watch_channels")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("channel_id", channelId)
          .eq("tenant_id", channel.tenant_id);
        if (deactivateError) throw deactivateError;

        await markProviderEventProcessed(supabase, providerEventId!);
        return jsonResponse({ received: true, channel_deactivated: true });
      }

      if (!["exists", "update"].includes(resourceState)) {
        await markProviderEventProcessed(supabase, providerEventId!);
        return jsonResponse({ received: true, ignored: true });
      }

      const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
      const response = await fetch(
        `${requiredEnv("SUPABASE_URL")}/functions/v1/google-calendar-sync`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tenant_id: channel.tenant_id }),
        },
      );
      if (!response.ok) {
        console.error("[calendar-watch] Tenant sync failed", {
          tenant_id: channel.tenant_id,
          status: response.status,
        });
        throw new Error(`Calendar sync failed with ${response.status}`);
      }

      const result = await response.json();
      const { error: auditError } = await supabase.from("audit_log").insert({
        tenant_id: channel.tenant_id,
        action: "google_calendar.watch_processed",
        payload_json: {
          channel_id: channelId,
          resource_state: resourceState,
          message_number: messageNumber,
          sync_result: result,
        },
      });
      if (auditError) console.error("[calendar-watch] Audit failed", auditError);

      await markProviderEventProcessed(supabase, providerEventId!);
      return jsonResponse({ received: true, synced: true });
    } catch (error) {
      await markProviderEventFailed(
        supabase,
        providerEventId!,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  } catch (error) {
    console.error("[calendar-watch] Processing failed", error);
    return jsonResponse({ error: "Calendar notification failed" }, 500);
  }
});
