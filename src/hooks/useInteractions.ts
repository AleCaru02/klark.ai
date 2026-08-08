import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LeadStatus } from "./useLeads";
import { Json } from "@/integrations/supabase/types";

export type InteractionChannel = "call" | "whatsapp" | "email" | "simulated";
export type InteractionDirection = "in" | "out";
export type InteractionOutcome = 
  | "answered" 
  | "no_answer" 
  | "busy" 
  | "opt_out" 
  | "appointment_set" 
  | "rescheduled" 
  | "cancelled" 
  | "none";

export interface Interaction {
  id: string;
  tenant_id: string;
  lead_id: string;
  channel: InteractionChannel;
  direction: InteractionDirection;
  content: string | null;
  outcome: InteractionOutcome | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export function useInteractions(leadId: string | null) {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const queryClient = useQueryClient();

  const { data: interactions, isLoading } = useQuery({
    queryKey: ["interactions", leadId],
    queryFn: async () => {
      if (!leadId || !tenantId) return [];

      const { data, error } = await supabase
        .from("interactions")
        .select("*")
        .eq("lead_id", leadId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Interaction[];
    },
    enabled: !!leadId && !!tenantId,
  });

  const createInteraction = useMutation({
    mutationFn: async ({
      leadId,
      channel,
      direction,
      content,
      outcome,
      meta,
      newStatus,
    }: {
      leadId: string;
      channel: InteractionChannel;
      direction: InteractionDirection;
      content?: string;
      outcome?: InteractionOutcome;
      meta?: Json;
      newStatus?: LeadStatus;
    }) => {
      if (!tenantId) throw new Error("No tenant");

      // Create interaction
      const { error: interactionError } = await supabase
        .from("interactions")
        .insert([{
          tenant_id: tenantId,
          lead_id: leadId,
          channel,
          direction,
          content: content || null,
          outcome: outcome || "none",
          meta: (meta || {}) as Json,
        }]);

      if (interactionError) throw interactionError;

      // Update lead status if provided
      if (newStatus) {
        const { error: updateError } = await supabase
          .from("leads")
          .update({
            status: newStatus,
            last_contact_at: new Date().toISOString(),
          })
          .eq("id", leadId);

        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interactions"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-detail"] });
      toast.success("Azione registrata");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  return {
    interactions: interactions || [],
    isLoading,
    createInteraction,
  };
}
