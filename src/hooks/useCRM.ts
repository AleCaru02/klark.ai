import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Contact {
  id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string | null;
  do_not_contact: boolean | null;
  tenant_id: string;
}

export interface ContactSource {
  id: string;
  contact_id: string;
  source: "facebook_leadads" | "contact_form" | "manual" | "import";
  created_at: string;
}

export type StageType = 
  | "new_lead"
  | "to_call"
  | "callback_scheduled"
  | "appointment_set"
  | "nurturing"
  | "closed_won"
  | "closed_lost";

export const STAGE_TYPE_LABELS: Record<StageType, string> = {
  new_lead: "Nuovo Lead",
  to_call: "Da Chiamare",
  callback_scheduled: "Richiamata Programmata",
  appointment_set: "Appuntamento Fissato",
  nurturing: "Nurturing",
  closed_won: "Chiuso (Vinto)",
  closed_lost: "Chiuso (Perso)",
};

export const STAGE_TYPES: StageType[] = [
  "new_lead", "to_call", "callback_scheduled", "appointment_set",
  "nurturing", "closed_won", "closed_lost",
];

export interface Stage {
  id: string;
  name: string;
  position: number;
  pipeline_id: string;
  stage_type: StageType;
  color: string;
  is_active: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  tenant_id: string;
}

export interface ContactStage {
  id: string;
  contact_id: string;
  stage_id: string;
  updated_at: string;
}

export interface LeadNote {
  id: string;
  contact_id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
}

export interface ContactWithDetails extends Contact {
  contact_sources: ContactSource[] | null;
  contact_stages: ContactStage[] | null;
}

export function useCRM() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch contacts with sources and stages
  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["crm-contacts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select(`
          *,
          contact_sources(*),
          contact_stages(*)
        `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as ContactWithDetails[];
    },
    enabled: !!tenantId,
  });

  // Fetch pipeline and stages
  const { data: pipelineData, isLoading: pipelineLoading } = useQuery({
    queryKey: ["crm-pipeline", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      // Get or create default pipeline
      const { data: pipelines, error: pipelineError } = await supabase
        .from("pipelines")
        .select("*")
        .eq("tenant_id", tenantId)
        .limit(1);

      if (pipelineError) throw pipelineError;

      let pipeline: Pipeline;

      if (!pipelines || pipelines.length === 0) {
        // Create default pipeline
        const { data: newPipeline, error: createError } = await supabase
          .from("pipelines")
          .insert({ tenant_id: tenantId, name: "Pipeline Principale" })
          .select()
          .single();

        if (createError) throw createError;
        pipeline = newPipeline;

        // Create default stages with stage_type
        const defaultStages = [
          { name: "Contatti Facebook", position: 0, pipeline_id: pipeline.id, tenant_id: tenantId, stage_type: "new_lead", color: "#3B82F6" },
          { name: "Da richiamare", position: 1, pipeline_id: pipeline.id, tenant_id: tenantId, stage_type: "to_call", color: "#F59E0B" },
          { name: "Appuntamento fissato", position: 2, pipeline_id: pipeline.id, tenant_id: tenantId, stage_type: "appointment_set", color: "#8B5CF6" },
          { name: "Contratti chiusi", position: 3, pipeline_id: pipeline.id, tenant_id: tenantId, stage_type: "closed_won", color: "#10B981" },
        ];

        await supabase.from("stages").insert(defaultStages);
      } else {
        pipeline = pipelines[0] as Pipeline;
      }

      // Fetch stages
      const { data: stages, error: stagesError } = await supabase
        .from("stages")
        .select("*")
        .eq("pipeline_id", pipeline.id)
        .order("position", { ascending: true });

      if (stagesError) throw stagesError;

      return { pipeline, stages: stages as Stage[] };
    },
    enabled: !!tenantId,
  });

  // Move contact to stage
  const moveContactToStage = useMutation({
    mutationFn: async ({ contactId, stageId }: { contactId: string; stageId: string }) => {
      if (!tenantId) throw new Error("No tenant");

      // Check if contact already has a stage
      const { data: existing } = await supabase
        .from("contact_stages")
        .select("id")
        .eq("contact_id", contactId)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("contact_stages")
          .update({ stage_id: stageId, updated_at: new Date().toISOString() })
          .eq("contact_id", contactId);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("contact_stages")
          .insert({ tenant_id: tenantId, contact_id: contactId, stage_id: stageId });
        if (error) throw error;
      }

      // Update contact's last_activity_at
      await supabase
        .from("contacts")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", contactId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      toast({ title: "Contatto spostato" });
    },
    onError: (error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Create contact
  const createContact = useMutation({
    mutationFn: async (data: { name: string; phone?: string; email?: string; source?: ContactSource["source"] }) => {
      if (!tenantId) throw new Error("No tenant");

      const { data: contact, error } = await supabase
        .from("contacts")
        .insert({
          tenant_id: tenantId,
          name: data.name,
          phone_e164: data.phone || null,
          email: data.email || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add source
      await supabase.from("contact_sources").insert({
        tenant_id: tenantId,
        contact_id: contact.id,
        source: data.source || "manual",
      });

      // Add to first stage
      if (pipelineData?.stages?.[0]) {
        await supabase.from("contact_stages").insert({
          tenant_id: tenantId,
          contact_id: contact.id,
          stage_id: pipelineData.stages[0].id,
        });
      }

      return contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      toast({ title: "Contatto creato" });
    },
    onError: (error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Delete contact
  const deleteContact = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      toast({ title: "Contatto eliminato" });
    },
    onError: (error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Get contacts by stage
  const getContactsByStage = (stageId: string) => {
    return (contacts || []).filter(
      (contact) => contact.contact_stages?.[0]?.stage_id === stageId
    );
  };

  // Get contacts without stage (for initial placement)
  const getContactsWithoutStage = () => {
    return (contacts || []).filter(
      (contact) => !contact.contact_stages || contact.contact_stages.length === 0
    );
  };

  // Get stage by stage_type (for AI/automations)
  const getStageByType = (stageType: StageType): Stage | undefined => {
    return (pipelineData?.stages || []).find(s => s.stage_type === stageType && s.is_active);
  };

  return {
    contacts,
    contactsLoading,
    pipeline: pipelineData?.pipeline,
    stages: pipelineData?.stages || [],
    pipelineLoading,
    moveContactToStage,
    createContact,
    deleteContact,
    getContactsByStage,
    getContactsWithoutStage,
    getStageByType,
  };
}

// Hook for contact details
export function useContactDetails(contactId: string | null) {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact-details", contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data, error } = await supabase
        .from("contacts")
        .select(`
          *,
          contact_sources(*),
          contact_stages(*, stages(*)),
          lead_form_answers(*),
          lead_notes(*)
        `)
        .eq("id", contactId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  // Fetch activity log (calls, messages, appointments)
  const { data: activityLog } = useQuery({
    queryKey: ["contact-activity", contactId],
    queryFn: async () => {
      if (!contactId) return [];

      const [callsRes, messagesRes, appointmentsRes] = await Promise.all([
        supabase
          .from("call_logs")
          .select("id, created_at, direction, connected_seconds, outcome_json")
          .eq("contact_id", contactId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("message_logs")
          .select("id, created_at, template_name, status, channel")
          .eq("contact_id", contactId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("appointments")
          .select("id, start_at, status, title")
          .eq("contact_id", contactId)
          .order("start_at", { ascending: false })
          .limit(20),
      ]);

      const activities: Array<{
        type: "call" | "message" | "appointment";
        id: string;
        created_at: string;
        data: any;
      }> = [];

      callsRes.data?.forEach((call) => {
        activities.push({
          type: "call",
          id: call.id,
          created_at: call.created_at,
          data: call,
        });
      });

      messagesRes.data?.forEach((msg) => {
        activities.push({
          type: "message",
          id: msg.id,
          created_at: msg.created_at,
          data: msg,
        });
      });

      appointmentsRes.data?.forEach((apt) => {
        activities.push({
          type: "appointment",
          id: apt.id,
          created_at: apt.start_at,
          data: apt,
        });
      });

      return activities.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!contactId,
  });

  // Add note
  const addNote = useMutation({
    mutationFn: async (noteText: string) => {
      if (!contactId || !tenantId) throw new Error("Missing data");
      const { error } = await supabase.from("lead_notes").insert({
        tenant_id: tenantId,
        contact_id: contactId,
        note_text: noteText,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-details", contactId] });
      toast({ title: "Nota aggiunta" });
    },
  });

  // Update contact
  const updateContact = useMutation({
    mutationFn: async (updates: Partial<Contact>) => {
      if (!contactId) throw new Error("No contact");
      const { error } = await supabase.from("contacts").update(updates).eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-details", contactId] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      toast({ title: "Contatto aggiornato" });
    },
  });

  return {
    contact,
    isLoading,
    activityLog: activityLog || [],
    addNote,
    updateContact,
  };
}
