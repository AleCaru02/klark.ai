import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface WhatsAppMessage {
  id: string;
  tenant_id: string | null;
  lead_id: string | null;
  appointment_id: string | null;
  wa_from: string;
  text: string | null;
  direction: string | null;
  message_type: string | null;
  delivery_status: string | null;
  ts: string;
  created_at: string;
}

export function useWhatsAppMessages(leadId: string | null) {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;

  const { data: messages, isLoading } = useQuery({
    queryKey: ["whatsapp-messages", leadId, tenantId],
    queryFn: async () => {
      if (!leadId || !tenantId) return [];

      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("lead_id", leadId)
        .eq("tenant_id", tenantId)
        .order("ts", { ascending: false });

      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!leadId && !!tenantId,
  });

  return {
    messages: messages || [],
    isLoading,
  };
}

export function useAppointmentMessages(appointmentId: string | null) {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;

  const { data: messages, isLoading } = useQuery({
    queryKey: ["appointment-whatsapp-messages", appointmentId, tenantId],
    queryFn: async () => {
      if (!appointmentId || !tenantId) return [];

      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("appointment_id", appointmentId)
        .eq("tenant_id", tenantId)
        .order("ts", { ascending: false });

      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!appointmentId && !!tenantId,
  });

  return {
    messages: messages || [],
    isLoading,
  };
}
