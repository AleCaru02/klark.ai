import {
  AuthError,
  createServiceClient,
  jsonResponse,
  requireServiceRole,
} from "../_shared/security.ts";

interface TenantSettings {
  tenant_id: string;
  retention_days: number;
}

interface ChatbotRetention {
  tenant_id: string;
  retention_days: number;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
  }

  try {
    requireServiceRole(request);
    const supabase = createServiceClient();
    const [settingsResult, chatbotResult] = await Promise.all([
      supabase.from("settings").select("tenant_id,retention_days"),
      supabase.from("site_chatbots").select("tenant_id,retention_days"),
    ]);
    if (settingsResult.error) throw settingsResult.error;
    if (chatbotResult.error) throw chatbotResult.error;

    const results = {
      tenantsProcessed: 0,
      callLogsDeleted: 0,
      messageLogsDeleted: 0,
      recordingsCleared: 0,
      siteChatSessionsDeleted: 0,
      expiredSiteChatSessionsClosed: 0,
      errors: [] as string[],
    };

    for (const setting of (settingsResult.data || []) as TenantSettings[]) {
      const cutoffDate = new Date(Date.now() - Number(setting.retention_days || 365) * 86_400_000);
      const cutoffIso = cutoffDate.toISOString();
      try {
        const { data: oldCallsWithRecordings, error: recordingsQueryError } = await supabase
          .from("call_logs")
          .select("id")
          .eq("tenant_id", setting.tenant_id)
          .lt("created_at", cutoffIso)
          .not("recording_url", "is", null);
        if (recordingsQueryError) throw recordingsQueryError;

        if (oldCallsWithRecordings?.length) {
          const { error } = await supabase
            .from("call_logs")
            .update({ recording_url: null, transcript: null })
            .eq("tenant_id", setting.tenant_id)
            .lt("created_at", cutoffIso);
          if (error) throw error;
          results.recordingsCleared += oldCallsWithRecordings.length;
        }

        const { data: deletedCalls, error: callsError } = await supabase
          .from("call_logs")
          .delete()
          .eq("tenant_id", setting.tenant_id)
          .lt("created_at", cutoffIso)
          .select("id");
        if (callsError) throw callsError;
        results.callLogsDeleted += deletedCalls?.length || 0;

        const { data: deletedMessages, error: messagesError } = await supabase
          .from("message_logs")
          .delete()
          .eq("tenant_id", setting.tenant_id)
          .lt("created_at", cutoffIso)
          .select("id");
        if (messagesError) throw messagesError;
        results.messageLogsDeleted += deletedMessages?.length || 0;
        results.tenantsProcessed += 1;
      } catch (error) {
        results.errors.push(`Tenant ${setting.tenant_id}: ${error instanceof Error ? error.message : "cleanup failed"}`);
      }
    }

    for (const chatbot of (chatbotResult.data || []) as ChatbotRetention[]) {
      const cutoffIso = new Date(
        Date.now() - Number(chatbot.retention_days || 90) * 86_400_000,
      ).toISOString();
      try {
        // Messages are deleted by ON DELETE CASCADE when the session is removed.
        const { data: deleted, error } = await supabase
          .from("site_chat_sessions")
          .delete()
          .eq("tenant_id", chatbot.tenant_id)
          .lt("created_at", cutoffIso)
          .select("id");
        if (error) throw error;
        results.siteChatSessionsDeleted += deleted?.length || 0;
      } catch (error) {
        results.errors.push(`Site chat tenant ${chatbot.tenant_id}: ${error instanceof Error ? error.message : "cleanup failed"}`);
      }
    }

    const { data: expiredSessions, error: expiredError } = await supabase
      .from("site_chat_sessions")
      .update({ status: "expired", last_seen_at: new Date().toISOString() })
      .eq("status", "active")
      .lt("expires_at", new Date().toISOString())
      .select("id");
    if (expiredError) results.errors.push(`Expired site chat sessions: ${expiredError.message}`);
    else results.expiredSiteChatSessionsClosed = expiredSessions?.length || 0;

    await supabase.from("audit_log").insert({
      actor_user_id: null,
      action: "retention_cleanup",
      payload_json: results,
    });

    return jsonResponse(results);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    if (status >= 500) console.error("[retention-cleanup] Failed", error);
    return jsonResponse({ error: status === 401 ? "Unauthorized" : "Retention cleanup failed" }, status);
  }
});
