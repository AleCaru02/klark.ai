import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export type MeetingType = "online" | "in_person";
export type MeetingProvider = "google_meet" | "zoom" | "call" | "other" | null;

interface CreateAppointmentParams {
  contactId: string;
  title: string;
  startAt: Date;
  durationMinutes: number;
  description?: string;
  meetingType?: MeetingType;
  meetingProvider?: MeetingProvider;
  location?: string;
}

export function useCreateAppointment() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createAppointment = useMutation({
    mutationFn: async (params: CreateAppointmentParams) => {
      if (!tenantId) throw new Error("No tenant");

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("No session");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-appointment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            contact_id: params.contactId,
            title: params.title,
            start_at: params.startAt.toISOString(),
            duration_minutes: params.durationMinutes,
            description: params.description,
            timezone: "Europe/Rome",
            meeting_type: params.meetingType || "online",
            meeting_provider: params.meetingProvider || null,
            location: params.location || null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Creazione appuntamento fallita");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["crm-sheets-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["crm-sheets-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["contact-details"] });
      queryClient.invalidateQueries({ queryKey: ["contact-activity"] });

      let message = "Appuntamento creato con successo";
      if (data.meet_link) {
        message += " con link Google Meet";
      } else if (data.zoom_link) {
        message += " con link Zoom";
      } else if (!data.google_connected && data.meeting_provider === "google_meet") {
        message += " (Google Calendar non connesso)";
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

  return { createAppointment };
}
