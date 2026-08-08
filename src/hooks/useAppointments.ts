import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppointmentStatus = 
  | "scheduled" 
  | "confirmed" 
  | "cancelled"
  | "canceled" 
  | "completed"
  | "no_show"
  | "rescheduled";

export interface Appointment {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  lead_id: string | null;
  title: string | null;
  meeting_type: string | null;
  start_at: string;
  end_at: string;
  timezone: string | null;
  meet_link: string | null;
  location: string | null;
  status: AppointmentStatus | null;
  confirmation_deadline_at: string | null;
  description: string | null;
  created_at: string;
}

export function useAppointments() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;

  const { data: appointments, isLoading, error } = useQuery({
    queryKey: ["appointments", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("start_at", { ascending: true });

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!tenantId,
  });

  return {
    appointments: appointments || [],
    isLoading,
    error,
  };
}

export function useLeadAppointment(leadId: string | null) {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;

  const { data: appointment, isLoading } = useQuery({
    queryKey: ["lead-appointment", leadId, tenantId],
    queryFn: async () => {
      if (!leadId || !tenantId) return null;

      // First check if lead has appointment_id
      const { data: lead } = await supabase
        .from("leads")
        .select("appointment_id")
        .eq("id", leadId)
        .single();

      if (!lead?.appointment_id) {
        // Check appointments table for lead_id
        const { data: appt } = await supabase
          .from("appointments")
          .select("*")
          .eq("lead_id", leadId)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return appt as Appointment | null;
      }

      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", lead.appointment_id)
        .single();

      if (error) return null;
      return data as Appointment;
    },
    enabled: !!leadId && !!tenantId,
  });

  return { appointment, isLoading };
}
