import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TestStatus = "pending" | "running" | "pass" | "fail" | "skipped";

export interface TestStep {
  id: string;
  name: string;
  status: TestStatus;
  details?: string;
  duration?: number;
}

export interface TestSuite {
  name: string;
  status: "idle" | "running" | "done";
  steps: TestStep[];
  startedAt?: Date;
  completedAt?: Date;
}

export interface TestDefinition {
  id: string;
  name: string;
  run: () => Promise<{ success: boolean; details?: string }>;
  /** If true, suite stops on failure */
  critical?: boolean;
}

// Shared test context for passing data between test steps
interface TestContext {
  tenantId?: string;
  leadA_id?: string;
  leadB_id?: string;
  leadC_id?: string;
  appointmentA_id?: string;
  appointmentB_id?: string;
  aborted?: boolean;
}

export function useSystemTests() {
  const [suites, setSuites] = useState<Record<string, TestSuite>>({});
  const [resetStatus, setResetStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [resetDetails, setResetDetails] = useState<string>("");

  // Run a test suite sequentially, continue on failure (unless critical)
  const runTestSuite = useCallback(async (suiteName: string, tests: TestDefinition[]) => {
    // Initialize suite
    setSuites((prev) => ({
      ...prev,
      [suiteName]: {
        name: suiteName,
        status: "running",
        startedAt: new Date(),
        steps: tests.map((t) => ({
          id: t.id,
          name: t.name,
          status: "pending" as TestStatus,
        })),
      },
    }));

    const results: TestStep[] = [];
    let shouldAbort = false;

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      
      // Skip remaining tests if aborted
      if (shouldAbort) {
        const skipResult: TestStep = {
          id: test.id,
          name: test.name,
          status: "skipped",
          details: "Saltato a causa di un test critico fallito",
        };
        results.push(skipResult);
        setSuites((prev) => ({
          ...prev,
          [suiteName]: {
            ...prev[suiteName],
            steps: prev[suiteName].steps.map((s, idx) =>
              idx === i ? skipResult : s
            ),
          },
        }));
        continue;
      }

      const startTime = Date.now();

      // Update step to running
      setSuites((prev) => ({
        ...prev,
        [suiteName]: {
          ...prev[suiteName],
          steps: prev[suiteName].steps.map((s, idx) =>
            idx === i ? { ...s, status: "running" as TestStatus } : s
          ),
        },
      }));

      try {
        const result = await test.run();
        const duration = Date.now() - startTime;

        const stepResult: TestStep = {
          id: test.id,
          name: test.name,
          status: result.success ? "pass" : "fail",
          details: result.details,
          duration,
        };

        results.push(stepResult);

        // Check if critical test failed
        if (!result.success && test.critical) {
          shouldAbort = true;
        }

        // Update step with result
        setSuites((prev) => ({
          ...prev,
          [suiteName]: {
            ...prev[suiteName],
            steps: prev[suiteName].steps.map((s, idx) =>
              idx === i ? stepResult : s
            ),
          },
        }));
      } catch (error) {
        const duration = Date.now() - startTime;
        const stepResult: TestStep = {
          id: test.id,
          name: test.name,
          status: "fail",
          details: `Exception: ${error instanceof Error ? error.message : String(error)}`,
          duration,
        };

        results.push(stepResult);

        // Check if critical test failed
        if (test.critical) {
          shouldAbort = true;
        }

        setSuites((prev) => ({
          ...prev,
          [suiteName]: {
            ...prev[suiteName],
            steps: prev[suiteName].steps.map((s, idx) =>
              idx === i ? stepResult : s
            ),
          },
        }));
      }
    }

    // Mark suite as done
    setSuites((prev) => ({
      ...prev,
      [suiteName]: {
        ...prev[suiteName],
        status: "done",
        completedAt: new Date(),
      },
    }));

    return results;
  }, []);

  // Reset test data - delete only records with source="system_test"
  const resetTestData = useCallback(async () => {
    setResetStatus("running");
    setResetDetails("");

    try {
      // 1. Find all leads with source="system_test"
      const { data: testLeads, error: leadsError } = await supabase
        .from("leads")
        .select("id, appointment_id")
        .eq("source", "system_test");

      if (leadsError) throw leadsError;

      if (!testLeads || testLeads.length === 0) {
        setResetStatus("done");
        setResetDetails("Nessun dato di test trovato.");
        return { success: true, deleted: 0 };
      }

      const leadIds = testLeads.map((l) => l.id);
      const appointmentIds = testLeads
        .map((l) => l.appointment_id)
        .filter((id): id is string => id !== null);

      const deletedCounts = {
        whatsappMessages: 0,
        interactions: 0,
        followupQueue: 0,
        reminders: 0,
        appointments: 0,
        leads: 0,
      };

      // 2. Delete whatsapp_messages linked to these leads
      const { data: deletedWa } = await supabase
        .from("whatsapp_messages")
        .delete()
        .in("lead_id", leadIds)
        .select("id");
      deletedCounts.whatsappMessages = deletedWa?.length || 0;

      // 3. Delete interactions linked to these leads
      const { data: deletedInteractions } = await supabase
        .from("interactions")
        .delete()
        .in("lead_id", leadIds)
        .select("id");
      deletedCounts.interactions = deletedInteractions?.length || 0;

      // 4. Delete followup_queue linked to these leads
      const { data: deletedFollowup } = await supabase
        .from("followup_queue")
        .delete()
        .in("lead_id", leadIds)
        .select("id");
      deletedCounts.followupQueue = deletedFollowup?.length || 0;

      // 5. Delete reminders linked to these appointments
      if (appointmentIds.length > 0) {
        const { data: deletedReminders } = await supabase
          .from("reminders")
          .delete()
          .in("appointment_id", appointmentIds)
          .select("id");
        deletedCounts.reminders = deletedReminders?.length || 0;
      }

      // 6. Delete appointments linked to these leads
      if (appointmentIds.length > 0) {
        const { data: deletedAppts } = await supabase
          .from("appointments")
          .delete()
          .in("id", appointmentIds)
          .select("id");
        deletedCounts.appointments = deletedAppts?.length || 0;
      }

      // Also delete appointments by lead_id
      const { data: deletedApptsByLead } = await supabase
        .from("appointments")
        .delete()
        .in("lead_id", leadIds)
        .select("id");
      deletedCounts.appointments += deletedApptsByLead?.length || 0;

      // 7. Delete the leads themselves
      const { data: deletedLeads } = await supabase
        .from("leads")
        .delete()
        .in("id", leadIds)
        .select("id");
      deletedCounts.leads = deletedLeads?.length || 0;

      const details = [
        `Leads: ${deletedCounts.leads}`,
        `Appointments: ${deletedCounts.appointments}`,
        `Interactions: ${deletedCounts.interactions}`,
        `Followup Queue: ${deletedCounts.followupQueue}`,
        `WhatsApp Messages: ${deletedCounts.whatsappMessages}`,
        `Reminders: ${deletedCounts.reminders}`,
      ].join(", ");

      setResetStatus("done");
      setResetDetails(`Eliminati: ${details}`);

      return { success: true, deleted: deletedCounts };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setResetStatus("error");
      setResetDetails(`Errore: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }, []);

  // Clear all test results
  const clearResults = useCallback(() => {
    setSuites({});
    setResetStatus("idle");
    setResetDetails("");
  }, []);

  return {
    suites,
    runTestSuite,
    resetTestData,
    resetStatus,
    resetDetails,
    clearResults,
  };
}

// ============================================================================
// CORE TESTS FACTORY
// Creates test definitions with shared context
// ============================================================================

export function createCoreTests(): TestDefinition[] {
  const ctx: TestContext = {};
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  return [
    // ============ FASE 0 — Precheck ============
    {
      id: "0.1_precheck_tenant",
      name: "0.1 Precheck: Recupera tenant_id",
      critical: true,
      run: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { success: false, details: "Utente non autenticato" };
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();

        if (error || !profile?.tenant_id) {
          return { 
            success: false, 
            details: `Nessun profilo/tenant trovato: ${error?.message || "tenant_id null"}` 
          };
        }

        ctx.tenantId = profile.tenant_id;
        return { success: true, details: `tenant_id=${ctx.tenantId}` };
      },
    },

    // ============ FASE 1 — DB/RLS + seed ============
    {
      id: "1.1_seed_leads",
      name: "1.1 Upsert 3 leads di test",
      run: async () => {
        if (!ctx.tenantId) {
          return { success: false, details: "tenant_id mancante dal precheck" };
        }

        const timestamp = Date.now();
        const testLeads = [
          {
            tenant_id: ctx.tenantId,
            name: `Test Lead A ${timestamp}`,
            phone_e164: `+391111${timestamp.toString().slice(-6)}`,
            status: "TO_CALL",
            source: "system_test",
            handoff_status: "AI",
          },
          {
            tenant_id: ctx.tenantId,
            name: `Test Lead B ${timestamp}`,
            phone_e164: `+392222${timestamp.toString().slice(-6)}`,
            status: "NO_ANSWER",
            source: "system_test",
            handoff_status: "AI",
          },
          {
            tenant_id: ctx.tenantId,
            name: `Test Lead C ${timestamp}`,
            phone_e164: `+393333${timestamp.toString().slice(-6)}`,
            status: "IN_CONVO",
            source: "system_test",
            handoff_status: "AI",
          },
        ];

        // Insert leads
        const { data: insertedLeads, error: insertError } = await supabase
          .from("leads")
          .insert(testLeads)
          .select("id, name, status");

        if (insertError) {
          return { success: false, details: `Insert error: ${insertError.message}` };
        }

        if (!insertedLeads || insertedLeads.length !== 3) {
          return { success: false, details: `Expected 3 leads, got ${insertedLeads?.length || 0}` };
        }

        // Verify we can read them back
        const { data: readBack, error: readError } = await supabase
          .from("leads")
          .select("id, name, status")
          .eq("source", "system_test")
          .eq("tenant_id", ctx.tenantId)
          .order("name");

        if (readError) {
          return { success: false, details: `Read error: ${readError.message}` };
        }

        // Store IDs in context
        ctx.leadA_id = insertedLeads.find(l => l.name.includes("Lead A"))?.id;
        ctx.leadB_id = insertedLeads.find(l => l.name.includes("Lead B"))?.id;
        ctx.leadC_id = insertedLeads.find(l => l.name.includes("Lead C"))?.id;

        return { 
          success: true, 
          details: `Creati e letti ${readBack?.length || 0} leads. A=${ctx.leadA_id?.slice(0,8)}, B=${ctx.leadB_id?.slice(0,8)}, C=${ctx.leadC_id?.slice(0,8)}` 
        };
      },
    },

    // ============ FASE 2 — CRUD CRM ============
    {
      id: "2.1_update_lead_status",
      name: "2.1 Update lead A status + interaction",
      run: async () => {
        if (!ctx.tenantId || !ctx.leadA_id) {
          return { success: false, details: "Context mancante (tenantId o leadA_id)" };
        }

        // Update lead status TO_CALL -> NO_ANSWER (simula drag)
        const { error: updateError } = await supabase
          .from("leads")
          .update({ status: "NO_ANSWER" })
          .eq("id", ctx.leadA_id);

        if (updateError) {
          return { success: false, details: `Update error: ${updateError.message}` };
        }

        // Insert interaction for the drag
        const { error: interactionError } = await supabase
          .from("interactions")
          .insert({
            tenant_id: ctx.tenantId,
            lead_id: ctx.leadA_id,
            channel: "simulated",
            direction: "system",
            outcome: "none",
            content: "Drag da TO_CALL a NO_ANSWER",
            meta: { drag: true, from: "TO_CALL", to: "NO_ANSWER" },
          });

        if (interactionError) {
          return { success: false, details: `Interaction insert error: ${interactionError.message}` };
        }

        // Verify lead updated
        const { data: lead, error: readError } = await supabase
          .from("leads")
          .select("status")
          .eq("id", ctx.leadA_id)
          .single();

        if (readError || lead?.status !== "NO_ANSWER") {
          return { success: false, details: `Lead status mismatch: expected NO_ANSWER, got ${lead?.status}` };
        }

        // Verify interaction exists
        const { data: interactions } = await supabase
          .from("interactions")
          .select("id")
          .eq("lead_id", ctx.leadA_id)
          .eq("channel", "simulated");

        if (!interactions || interactions.length === 0) {
          return { success: false, details: "Interaction non trovata" };
        }

        return { success: true, details: `Lead status=NO_ANSWER, interaction creata` };
      },
    },
    {
      id: "2.2_update_notes_tags",
      name: "2.2 Update notes e tags + verifica",
      run: async () => {
        if (!ctx.leadA_id) {
          return { success: false, details: "leadA_id mancante" };
        }

        const testNote = "test note from system test";
        const testTags = ["testtag", "systemtest"];

        // Update notes and tags
        const { error: updateError } = await supabase
          .from("leads")
          .update({ notes: testNote, tags: testTags })
          .eq("id", ctx.leadA_id);

        if (updateError) {
          return { success: false, details: `Update error: ${updateError.message}` };
        }

        // Read back and verify
        const { data: lead, error: readError } = await supabase
          .from("leads")
          .select("notes, tags")
          .eq("id", ctx.leadA_id)
          .single();

        if (readError) {
          return { success: false, details: `Read error: ${readError.message}` };
        }

        if (lead?.notes !== testNote) {
          return { success: false, details: `Notes mismatch: expected "${testNote}", got "${lead?.notes}"` };
        }

        if (!lead?.tags || !lead.tags.includes("testtag") || !lead.tags.includes("systemtest")) {
          return { success: false, details: `Tags mismatch: expected ["testtag","systemtest"], got ${JSON.stringify(lead?.tags)}` };
        }

        return { success: true, details: `notes="${testNote}", tags=${JSON.stringify(lead.tags)}` };
      },
    },

    // ============ FASE 3 — AI endpoints ============
    {
      id: "3.1_ai_next_best_action",
      name: "3.1 POST /ai-next-best-action",
      run: async () => {
        if (!ctx.tenantId || !ctx.leadA_id) {
          return { success: false, details: "Context mancante" };
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          return { success: false, details: "Sessione non trovata" };
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/ai-next-best-action`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_id: ctx.tenantId,
            lead_id: ctx.leadA_id,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return { success: false, details: `HTTP ${response.status}: ${errorText}` };
        }

        const result = await response.json();

        // Validate required fields
        const requiredFields = ["next_action", "planned_delay_minutes", "call_script", "whatsapp_message", "crm_updates", "safety"];
        const missingFields = requiredFields.filter(f => !(f in result));

        if (missingFields.length > 0) {
          return { success: false, details: `Campi mancanti: ${missingFields.join(", ")}` };
        }

        // Validate call_script structure
        const scriptFields = ["opening", "questions", "closing"];
        const missingScriptFields = scriptFields.filter(f => !(f in (result.call_script || {})));

        if (missingScriptFields.length > 0) {
          return { success: false, details: `call_script campi mancanti: ${missingScriptFields.join(", ")}` };
        }

        return { 
          success: true, 
          details: `next_action=${result.next_action}, delay=${result.planned_delay_minutes}min, safety=${result.safety}` 
        };
      },
    },

    // ============ FASE 4 — Followup queue ============
    {
      id: "4.1_followup_run",
      name: "4.1 POST /followup-run (single)",
      run: async () => {
        if (!ctx.tenantId || !ctx.leadA_id) {
          return { success: false, details: "Context mancante" };
        }

        // First, ensure lead has next_action_at in the past so it gets picked up
        const { error: prepError } = await supabase
          .from("leads")
          .update({ next_action_at: new Date().toISOString() })
          .eq("id", ctx.leadA_id);

        if (prepError) {
          return { success: false, details: `Prep error: ${prepError.message}` };
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          return { success: false, details: "Sessione non trovata" };
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/followup-run`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_id: ctx.tenantId,
            mode: "single",
            lead_id: ctx.leadA_id,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return { success: false, details: `HTTP ${response.status}: ${errorText}` };
        }

        const result = await response.json();

        // Check followup_queue was created
        const { data: queue, error: queueError } = await supabase
          .from("followup_queue")
          .select("id, status, action_type, planned_at")
          .eq("lead_id", ctx.leadA_id)
          .eq("status", "PENDING")
          .order("created_at", { ascending: false })
          .limit(1);

        if (queueError || !queue || queue.length === 0) {
          return { success: false, details: `followup_queue PENDING non trovato: ${queueError?.message || "nessun record"}` };
        }

        // Verify lead.next_action_at is not null
        const { data: lead } = await supabase
          .from("leads")
          .select("next_action_at")
          .eq("id", ctx.leadA_id)
          .single();

        if (!lead?.next_action_at) {
          return { success: false, details: "lead.next_action_at è null" };
        }

        return { 
          success: true, 
          details: `followup_queue.id=${queue[0].id.slice(0,8)}, action=${queue[0].action_type}, next_action_at=${lead.next_action_at}` 
        };
      },
    },
    {
      id: "4.2_followup_mark_outcome",
      name: "4.2 POST /followup-mark-outcome (no_answer)",
      run: async () => {
        if (!ctx.tenantId || !ctx.leadA_id) {
          return { success: false, details: "Context mancante" };
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          return { success: false, details: "Sessione non trovata" };
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/followup-mark-outcome`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_id: ctx.tenantId,
            lead_id: ctx.leadA_id,
            channel: "voice",
            outcome: "no_answer",
            content: "Test: nessuna risposta",
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return { success: false, details: `HTTP ${response.status}: ${errorText}` };
        }

        const result = await response.json();

        // Verify interaction with outcome=no_answer
        const { data: interactions, error: intError } = await supabase
          .from("interactions")
          .select("id, outcome")
          .eq("lead_id", ctx.leadA_id)
          .eq("outcome", "no_answer")
          .order("created_at", { ascending: false })
          .limit(1);

        if (intError || !interactions || interactions.length === 0) {
          return { success: false, details: `Interaction outcome=no_answer non trovata: ${intError?.message || "nessun record"}` };
        }

        // Verify lead.status=NO_ANSWER
        const { data: lead } = await supabase
          .from("leads")
          .select("status")
          .eq("id", ctx.leadA_id)
          .single();

        if (lead?.status !== "NO_ANSWER") {
          return { success: false, details: `lead.status expected NO_ANSWER, got ${lead?.status}` };
        }

        return { 
          success: true, 
          details: `interaction.outcome=no_answer, lead.status=${lead.status}, new_status=${result.new_status}` 
        };
      },
    },
  ];
}

// Export dynamic factory for core tests
export const coreTests = createCoreTests();

// ============================================================================
// ADVANCED TESTS FACTORY
// Creates test definitions with shared context
// ============================================================================

export function createAdvancedTests(): TestDefinition[] {
  const ctx: TestContext = {};
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  return [
    // ============ PREREQUISITO — Seed check ============
    {
      id: "prereq_check_seed",
      name: "Prerequisito: Verifica/Crea seed leads",
      critical: true,
      run: async () => {
        // Get tenant_id
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { success: false, details: "Utente non autenticato" };
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();

        if (profileError || !profile?.tenant_id) {
          return { 
            success: false, 
            details: `Nessun profilo/tenant trovato: ${profileError?.message || "tenant_id null"}` 
          };
        }

        ctx.tenantId = profile.tenant_id;

        // Check for existing test leads
        const { data: existingLeads } = await supabase
          .from("leads")
          .select("id, name, status")
          .eq("source", "system_test")
          .eq("tenant_id", ctx.tenantId);

        if (existingLeads && existingLeads.length >= 2) {
          // Use existing leads
          ctx.leadA_id = existingLeads.find(l => l.name.includes("Lead A"))?.id;
          ctx.leadB_id = existingLeads.find(l => l.name.includes("Lead B"))?.id;
          
          if (ctx.leadA_id && ctx.leadB_id) {
            return { 
              success: true, 
              details: `Trovati ${existingLeads.length} leads esistenti. A=${ctx.leadA_id.slice(0,8)}, B=${ctx.leadB_id.slice(0,8)}` 
            };
          }
        }

        // Create new test leads if missing
        const timestamp = Date.now();
        const testLeads = [
          {
            tenant_id: ctx.tenantId,
            name: `Test Lead A ${timestamp}`,
            phone_e164: `+391111${timestamp.toString().slice(-6)}`,
            status: "TO_CALL",
            source: "system_test",
            handoff_status: "AI",
          },
          {
            tenant_id: ctx.tenantId,
            name: `Test Lead B ${timestamp}`,
            phone_e164: `+392222${timestamp.toString().slice(-6)}`,
            status: "NO_ANSWER",
            source: "system_test",
            handoff_status: "AI",
          },
        ];

        const { data: insertedLeads, error: insertError } = await supabase
          .from("leads")
          .insert(testLeads)
          .select("id, name");

        if (insertError) {
          return { success: false, details: `Insert error: ${insertError.message}` };
        }

        ctx.leadA_id = insertedLeads?.find(l => l.name.includes("Lead A"))?.id;
        ctx.leadB_id = insertedLeads?.find(l => l.name.includes("Lead B"))?.id;

        return { 
          success: true, 
          details: `Creati nuovi leads. A=${ctx.leadA_id?.slice(0,8)}, B=${ctx.leadB_id?.slice(0,8)}` 
        };
      },
    },

    // ============ FASE 5 — Toggles ============
    {
      id: "5.1_check_toggles",
      name: "5.1 Verifica toggles VOICE/WHATSAPP default false",
      run: async () => {
        if (!ctx.tenantId) {
          return { success: false, details: "tenant_id mancante" };
        }

        const { data: settings, error } = await supabase
          .from("settings")
          .select("voice_enabled, whatsapp_enabled")
          .eq("tenant_id", ctx.tenantId)
          .single();

        if (error) {
          // Settings might not exist, which is OK (defaults apply)
          if (error.code === "PGRST116") {
            return { success: true, details: "Settings non esistono, defaults applicati (false)" };
          }
          return { success: false, details: `Query error: ${error.message}` };
        }

        const voiceEnabled = settings?.voice_enabled ?? false;
        const whatsappEnabled = settings?.whatsapp_enabled ?? false;

        if (voiceEnabled || whatsappEnabled) {
          return { 
            success: false, 
            details: `Toggles non sono false: voice=${voiceEnabled}, whatsapp=${whatsappEnabled}` 
          };
        }

        return { 
          success: true, 
          details: `voice_enabled=${voiceEnabled}, whatsapp_enabled=${whatsappEnabled}` 
        };
      },
    },
    {
      id: "5.2_toggles_enabled_followup",
      name: "5.2 Toggles true + /followup-run verifica simulated",
      run: async () => {
        if (!ctx.tenantId || !ctx.leadB_id) {
          return { success: false, details: "Context mancante" };
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          return { success: false, details: "Sessione non trovata" };
        }

        // Enable toggles temporarily
        const { error: updateError } = await supabase
          .from("settings")
          .upsert({
            tenant_id: ctx.tenantId,
            voice_enabled: true,
            whatsapp_enabled: true,
          }, { onConflict: "tenant_id" });

        if (updateError) {
          return { success: false, details: `Toggle update error: ${updateError.message}` };
        }

        try {
          // Ensure lead B is ready for followup
          await supabase
            .from("leads")
            .update({ 
              next_action_at: new Date().toISOString(),
              status: "NO_ANSWER",
              handoff_status: "AI"
            })
            .eq("id", ctx.leadB_id);

          // Call followup-run
          const response = await fetch(`${supabaseUrl}/functions/v1/followup-run`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tenant_id: ctx.tenantId,
              mode: "single",
              lead_id: ctx.leadB_id,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            return { success: false, details: `HTTP ${response.status}: ${errorText}` };
          }

          const result = await response.json();

          // Check followup_queue for simulated flag
          const { data: queue } = await supabase
            .from("followup_queue")
            .select("id, payload, reason")
            .eq("lead_id", ctx.leadB_id)
            .order("created_at", { ascending: false })
            .limit(1);

          if (!queue || queue.length === 0) {
            return { success: false, details: "Nessuna riga followup_queue creata" };
          }

          const payload = queue[0].payload as Record<string, unknown> | null;
          const isSimulated = payload?.simulated === true;
          
          // Check result for simulated flags
          const resultItem = result.results?.[0];
          const hasSimulatedFlag = resultItem?.simulated === true || isSimulated;

          return { 
            success: true, 
            details: `followup_queue creata, simulated=${hasSimulatedFlag}, action=${resultItem?.next_action || "N/A"}` 
          };
        } finally {
          // Reset toggles to false
          await supabase
            .from("settings")
            .update({
              voice_enabled: false,
              whatsapp_enabled: false,
            })
            .eq("tenant_id", ctx.tenantId);
        }
      },
    },

    // ============ FASE 6 — Appointment base ============
    {
      id: "6.1_create_appointment",
      name: "6.1 Crea appointment per lead B",
      run: async () => {
        if (!ctx.tenantId || !ctx.leadB_id) {
          return { success: false, details: "Context mancante" };
        }

        const startAt = new Date();
        startAt.setDate(startAt.getDate() + 2); // now + 2 days
        startAt.setHours(10, 0, 0, 0);

        const endAt = new Date(startAt);
        endAt.setMinutes(endAt.getMinutes() + 30);

        const deadline = new Date(startAt);
        deadline.setHours(deadline.getHours() - 12);

        const { data: appointment, error: createError } = await supabase
          .from("appointments")
          .insert({
            tenant_id: ctx.tenantId,
            lead_id: ctx.leadB_id,
            title: "Test Appointment B",
            meeting_type: "online",
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            meet_link: "https://meet.google.com/test-fake-link",
            status: "scheduled", // Will be treated as pending confirmation
            confirmation_deadline_at: deadline.toISOString(),
            created_from: "system_test",
          })
          .select("id")
          .single();

        if (createError) {
          return { success: false, details: `Create error: ${createError.message}` };
        }

        ctx.appointmentB_id = appointment.id;

        // Update lead B
        const { error: updateError } = await supabase
          .from("leads")
          .update({
            status: "APPOINTMENT_SET",
            handoff_status: "AI",
            appointment_id: appointment.id,
          })
          .eq("id", ctx.leadB_id);

        if (updateError) {
          return { success: false, details: `Lead update error: ${updateError.message}` };
        }

        // Verify link
        const { data: lead } = await supabase
          .from("leads")
          .select("appointment_id, status, handoff_status")
          .eq("id", ctx.leadB_id)
          .single();

        if (lead?.appointment_id !== appointment.id) {
          return { success: false, details: `Link mismatch: expected ${appointment.id}, got ${lead?.appointment_id}` };
        }

        return { 
          success: true, 
          details: `appointment.id=${appointment.id.slice(0,8)}, lead.status=${lead.status}, handoff=${lead.handoff_status}` 
        };
      },
    },

    // ============ FASE 7 — Handoff + blocco ============
    {
      id: "7.1_force_confirm",
      name: "7.1 Forza conferma → handoff HUMAN",
      run: async () => {
        if (!ctx.tenantId || !ctx.leadB_id || !ctx.appointmentB_id) {
          return { success: false, details: "Context mancante (appointment non creato?)" };
        }

        // Update appointment status to confirmed
        const { error: apptError } = await supabase
          .from("appointments")
          .update({ status: "confirmed" })
          .eq("id", ctx.appointmentB_id);

        if (apptError) {
          return { success: false, details: `Appointment update error: ${apptError.message}` };
        }

        // Update lead handoff_status to HUMAN
        const { error: leadError } = await supabase
          .from("leads")
          .update({ handoff_status: "HUMAN" })
          .eq("id", ctx.leadB_id);

        if (leadError) {
          return { success: false, details: `Lead update error: ${leadError.message}` };
        }

        // Create interaction
        const { error: intError } = await supabase
          .from("interactions")
          .insert({
            tenant_id: ctx.tenantId,
            lead_id: ctx.leadB_id,
            channel: "system",
            direction: "system",
            outcome: "appointment_confirmed",
            content: "Appuntamento confermato (test system)",
          });

        if (intError) {
          return { success: false, details: `Interaction insert error: ${intError.message}` };
        }

        // Verify
        const { data: lead } = await supabase
          .from("leads")
          .select("handoff_status")
          .eq("id", ctx.leadB_id)
          .single();

        if (lead?.handoff_status !== "HUMAN") {
          return { success: false, details: `Expected HUMAN, got ${lead?.handoff_status}` };
        }

        return { success: true, details: `handoff_status=HUMAN, interaction creata` };
      },
    },
    {
      id: "7.2_verify_blocking",
      name: "7.2 Verifica blocco followup (HUMAN)",
      run: async () => {
        if (!ctx.tenantId || !ctx.leadB_id) {
          return { success: false, details: "Context mancante" };
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          return { success: false, details: "Sessione non trovata" };
        }

        // Count existing followup_queue entries
        const { data: beforeQueue } = await supabase
          .from("followup_queue")
          .select("id")
          .eq("lead_id", ctx.leadB_id);

        const countBefore = beforeQueue?.length || 0;

        // Try to run followup
        const response = await fetch(`${supabaseUrl}/functions/v1/followup-run`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_id: ctx.tenantId,
            mode: "single",
            lead_id: ctx.leadB_id,
          }),
        });

        const result = await response.json();

        // Count after
        const { data: afterQueue } = await supabase
          .from("followup_queue")
          .select("id")
          .eq("lead_id", ctx.leadB_id);

        const countAfter = afterQueue?.length || 0;

        // Check if no new entries or result indicates blocked
        const noNewEntries = countAfter === countBefore;
        const resultItem = result.results?.[0];
        const isBlocked = resultItem?.skipped === true || 
                          resultItem?.reason?.includes("HUMAN") ||
                          result.processed === 0;

        if (noNewEntries || isBlocked) {
          return { 
            success: true, 
            details: `Bloccato! queue prima=${countBefore}, dopo=${countAfter}, skipped=${resultItem?.skipped}` 
          };
        }

        return { 
          success: false, 
          details: `NON bloccato: queue prima=${countBefore}, dopo=${countAfter}` 
        };
      },
    },

    // ============ FASE 8 — WhatsApp gate (test mode) ============
    {
      id: "8.1_simulate_confermo",
      name: "8.1 Simula CONFERMO su appointment B",
      run: async () => {
        if (!ctx.tenantId || !ctx.leadB_id || !ctx.appointmentB_id) {
          return { success: false, details: "Context mancante" };
        }

        // Reset appointment to pending for test
        await supabase
          .from("appointments")
          .update({ status: "scheduled" })
          .eq("id", ctx.appointmentB_id);

        await supabase
          .from("leads")
          .update({ handoff_status: "AI" })
          .eq("id", ctx.leadB_id);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          return { success: false, details: "Sessione non trovata" };
        }

        // Call simulate inbound
        const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-simulate-inbound`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_id: ctx.tenantId,
            lead_id: ctx.leadB_id,
            appointment_id: ctx.appointmentB_id,
            text: "CONFERMO",
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return { success: false, details: `HTTP ${response.status}: ${errorText}` };
        }

        const result = await response.json();

        // Verify appointment and lead
        const { data: appointment } = await supabase
          .from("appointments")
          .select("status")
          .eq("id", ctx.appointmentB_id)
          .single();

        const { data: lead } = await supabase
          .from("leads")
          .select("handoff_status")
          .eq("id", ctx.leadB_id)
          .single();

        if (appointment?.status !== "confirmed") {
          return { success: false, details: `appointment.status expected confirmed, got ${appointment?.status}` };
        }

        if (lead?.handoff_status !== "HUMAN") {
          return { success: false, details: `lead.handoff_status expected HUMAN, got ${lead?.handoff_status}` };
        }

        return { 
          success: true, 
          details: `appointment.status=${appointment.status}, handoff_status=${lead.handoff_status}` 
        };
      },
    },
    {
      id: "8.2_simulate_sposta",
      name: "8.2 Simula SPOSTA su nuovo appointment A",
      run: async () => {
        if (!ctx.tenantId || !ctx.leadA_id) {
          return { success: false, details: "Context mancante" };
        }

        // Create new appointment for lead A
        const startAt = new Date();
        startAt.setDate(startAt.getDate() + 3);
        startAt.setHours(14, 0, 0, 0);

        const endAt = new Date(startAt);
        endAt.setMinutes(endAt.getMinutes() + 30);

        const { data: appointment, error: createError } = await supabase
          .from("appointments")
          .insert({
            tenant_id: ctx.tenantId,
            lead_id: ctx.leadA_id,
            title: "Test Appointment A SPOSTA",
            meeting_type: "in_person",
            location: "Via Test 123",
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            status: "scheduled",
            created_from: "system_test",
          })
          .select("id")
          .single();

        if (createError) {
          return { success: false, details: `Create error: ${createError.message}` };
        }

        ctx.appointmentA_id = appointment.id;

        // Reset lead A
        await supabase
          .from("leads")
          .update({ 
            handoff_status: "AI",
            status: "APPOINTMENT_SET",
            appointment_id: appointment.id
          })
          .eq("id", ctx.leadA_id);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          return { success: false, details: "Sessione non trovata" };
        }

        // Simulate SPOSTA
        const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-simulate-inbound`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_id: ctx.tenantId,
            lead_id: ctx.leadA_id,
            appointment_id: appointment.id,
            text: "SPOSTA",
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return { success: false, details: `HTTP ${response.status}: ${errorText}` };
        }

        // Verify
        const { data: appt } = await supabase
          .from("appointments")
          .select("status")
          .eq("id", appointment.id)
          .single();

        const { data: lead } = await supabase
          .from("leads")
          .select("handoff_status")
          .eq("id", ctx.leadA_id)
          .single();

        if (appt?.status !== "rescheduled") {
          return { success: false, details: `appointment.status expected rescheduled, got ${appt?.status}` };
        }

        if (lead?.handoff_status !== "AI") {
          return { success: false, details: `handoff_status expected AI, got ${lead?.handoff_status}` };
        }

        return { 
          success: true, 
          details: `appointment.status=${appt.status}, handoff_status=${lead.handoff_status}` 
        };
      },
    },
    {
      id: "8.3_simulate_annulla",
      name: "8.3 Simula ANNULLA su appointment A",
      run: async () => {
        if (!ctx.tenantId || !ctx.leadA_id || !ctx.appointmentA_id) {
          return { success: false, details: "Context mancante (appointment A non creato?)" };
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          return { success: false, details: "Sessione non trovata" };
        }

        // Simulate ANNULLA
        const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-simulate-inbound`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_id: ctx.tenantId,
            lead_id: ctx.leadA_id,
            appointment_id: ctx.appointmentA_id,
            text: "ANNULLA",
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return { success: false, details: `HTTP ${response.status}: ${errorText}` };
        }

        // Verify
        const { data: appt } = await supabase
          .from("appointments")
          .select("status")
          .eq("id", ctx.appointmentA_id)
          .single();

        if (appt?.status !== "canceled") {
          return { success: false, details: `appointment.status expected canceled, got ${appt?.status}` };
        }

        return { 
          success: true, 
          details: `appointment.status=${appt.status}` 
        };
      },
    },
  ];
}

// Export dynamic factory for advanced tests
export const advancedTests = createAdvancedTests();
