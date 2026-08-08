import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type LeadStatus = 
  | "NEW" 
  | "TO_CALL" 
  | "IN_CONVO" 
  | "NO_ANSWER" 
  | "APPOINTMENT_SET" 
  | "CLIENT" 
  | "LOST" 
  | "DO_NOT_CONTACT";

export interface Lead {
  id: string;
  tenant_id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
  source: string | null;
  form_payload: Record<string, unknown> | null;
  status: LeadStatus;
  priority_score: number;
  tags: string[];
  notes: string | null;
  last_contact_at: string | null;
  next_action_at: string | null;
  created_at: string;
  handoff_status?: string;
  appointment_id?: string | null;
  appointment?: { status: string } | null;
}

interface UseLeadsOptions {
  status?: LeadStatus | null;
  source?: string | null;
  search?: string;
}

export function useLeads(options: UseLeadsOptions = {}) {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const queryClient = useQueryClient();

  const { data: leads, isLoading, error } = useQuery({
    queryKey: ["leads", tenantId, options],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from("leads")
        .select(`
          *,
          appointment:appointments!leads_appointment_id_fkey(status)
        `)
        .eq("tenant_id", tenantId)
        .order("priority_score", { ascending: false })
        .order("created_at", { ascending: false });

      if (options.status) {
        query = query.eq("status", options.status);
      }

      if (options.source) {
        query = query.eq("source", options.source);
      }

      if (options.search) {
        query = query.or(
          `name.ilike.%${options.search}%,phone_e164.ilike.%${options.search}%,email.ilike.%${options.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!tenantId,
  });

  const updateLeadStatus = useMutation({
    mutationFn: async ({ 
      leadId, 
      newStatus, 
      oldStatus 
    }: { 
      leadId: string; 
      newStatus: LeadStatus; 
      oldStatus: LeadStatus;
    }) => {
      if (!tenantId) throw new Error("No tenant");

      // Update lead status
      const { error: updateError } = await supabase
        .from("leads")
        .update({ 
          status: newStatus, 
          last_contact_at: new Date().toISOString() 
        })
        .eq("id", leadId);

      if (updateError) throw updateError;

      // Log interaction for drag
      const { error: interactionError } = await supabase
        .from("interactions")
        .insert({
          tenant_id: tenantId,
          lead_id: leadId,
          channel: "simulated",
          direction: "out",
          content: `Status cambiato da ${oldStatus} a ${newStatus}`,
          outcome: "none",
          meta: { drag: true, from: oldStatus, to: newStatus },
        });

      if (interactionError) throw interactionError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead aggiornato");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const updateLead = useMutation({
    mutationFn: async ({ 
      leadId, 
      updates 
    }: { 
      leadId: string; 
      updates: { notes?: string; tags?: string[] };
    }) => {
      const { error } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-detail"] });
      toast.success("Lead aggiornato");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  return {
    leads: leads || [],
    isLoading,
    error,
    updateLeadStatus,
    updateLead,
  };
}

export function useLeadDetail(leadId: string | null) {
  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead-detail", leadId],
    queryFn: async () => {
      if (!leadId) return null;

      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();

      if (error) throw error;
      return data as Lead;
    },
    enabled: !!leadId,
  });

  return { lead, isLoading };
}
