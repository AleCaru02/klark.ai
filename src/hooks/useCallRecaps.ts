import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface CallRecap {
  id: string;
  contact_id: string;
  summary_bullets_json: string[];
  next_step: string;
  objections: string | null;
  priority: "alta" | "media" | "bassa";
  raw_input: string | null;
  created_at: string;
  updated_at: string;
}

export function useCallRecaps(contactId: string | null) {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: recaps, isLoading } = useQuery({
    queryKey: ["call-recaps", contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const { data, error } = await supabase
        .from("lead_call_recaps")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as CallRecap[];
    },
    enabled: !!contactId,
  });

  const generateRecap = useMutation({
    mutationFn: async ({
      callNotes,
      transcript,
      callLogId,
      regenerate = false,
    }: {
      callNotes?: string;
      transcript?: string;
      callLogId?: string;
      regenerate?: boolean;
    }) => {
      if (!tenantId || !contactId) throw new Error("Missing data");

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("No session");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-call-recap`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            contact_id: contactId,
            call_log_id: callLogId,
            call_notes: callNotes,
            transcript,
            regenerate,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
          throw new Error("Limite di richieste raggiunto, riprova tra qualche minuto");
        }
        if (response.status === 402) {
          throw new Error("Crediti AI esauriti");
        }
        throw new Error(error.error || "Generazione fallita");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["call-recaps", contactId] });
      queryClient.invalidateQueries({ queryKey: ["contact-details", contactId] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });

      let message = "Recap generato con successo";
      if (data.stage_moved_to) {
        message += `. Lead spostato in "${data.stage_moved_to}"`;
      }

      toast({ title: message });
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    recaps: recaps || [],
    isLoading,
    latestRecap: recaps?.[0] || null,
    generateRecap,
  };
}
