import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Reminder {
  id: string;
  contact_id: string;
  appointment_id: string;
  channel: string;
  reminder_type: string;
  when_ts: string;
  status: string;
  payload_json: Record<string, any>;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export function useReminders(contactId?: string | null) {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;

  const { data: reminders, isLoading, refetch } = useQuery({
    queryKey: ["reminders", contactId, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from("reminders")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("when_ts", { ascending: false })
        .limit(50);

      if (contactId) {
        query = query.eq("contact_id", contactId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as Reminder[];
    },
    enabled: !!tenantId,
  });

  const pendingReminders = reminders?.filter((r) => r.status === "pending") || [];
  const sentReminders = reminders?.filter((r) => r.status === "sent") || [];

  return {
    reminders: reminders || [],
    pendingReminders,
    sentReminders,
    isLoading,
    refetch,
  };
}
