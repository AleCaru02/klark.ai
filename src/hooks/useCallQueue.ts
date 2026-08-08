import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CallQueueItem {
  id: string;
  tenant_id: string;
  contact_id: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  priority: number;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  last_call_sid: string | null;
  notes: string | null;
  outcome: string | null;
  last_voice_outcome: string | null;
  last_wa_sent_at: string | null;
  last_wa_outcome: string | null;
  callback_time: string | null;
  callback_source: string | null;
  next_action_channel: string | null;
  wa_available: boolean | null;
  created_at: string;
  updated_at: string;
  contact?: {
    id: string;
    name: string;
    phone_e164: string | null;
    email: string | null;
  };
}

export function useCallQueue() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const queryClient = useQueryClient();

  const { data: queueItems, isLoading, error } = useQuery({
    queryKey: ["call_queue", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("call_queue")
        .select(`
          *,
          contact:contacts(id, name, phone_e164, email)
        `)
        .eq("tenant_id", tenantId)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as unknown as CallQueueItem[];
    },
    enabled: !!tenantId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const update: Record<string, unknown> = { status };
      if (notes !== undefined) update.notes = notes;

      const { error } = await supabase
        .from("call_queue")
        .update(update as never)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call_queue", tenantId] });
      toast.success("Stato aggiornato");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const addToQueue = useMutation({
    mutationFn: async ({ contactId, priority = 0, maxAttempts = 5 }: { contactId: string; priority?: number; maxAttempts?: number }) => {
      if (!tenantId) throw new Error("No tenant");

      const { error } = await supabase.from("call_queue").insert({
        tenant_id: tenantId,
        contact_id: contactId,
        status: "pending",
        priority,
        max_attempts: maxAttempts,
        next_attempt_at: new Date().toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call_queue", tenantId] });
      toast.success("Aggiunto alla coda chiamate");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const removeFromQueue = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("call_queue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call_queue", tenantId] });
      toast.success("Rimosso dalla coda");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const triggerCall = useMutation({
    mutationFn: async ({ contactId, queueId }: { contactId: string; queueId: string }) => {
      if (!tenantId) throw new Error("No tenant");

      const { data, error } = await supabase.functions.invoke("twilio-make-call", {
        body: {
          tenant_id: tenantId,
          contact_id: contactId,
          call_queue_id: queueId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call_queue", tenantId] });
      toast.success("Chiamata avviata");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const pendingItems = queueItems?.filter((item) => item.status === "pending" || item.status === "no_answer") || [];
  const completedItems = queueItems?.filter((item) => item.status === "completed" || item.status === "booked") || [];
  const failedItems = queueItems?.filter((item) => item.status === "failed") || [];

  return {
    queueItems: queueItems || [],
    pendingItems,
    completedItems,
    failedItems,
    isLoading,
    error,
    updateStatus,
    addToQueue,
    removeFromQueue,
    triggerCall,
  };
}
