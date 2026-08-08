import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateAppointmentData {
  tenant_id: string;
  title: string;
  description?: string;
  location?: string;
  start_at: string;
  end_at: string;
  timezone?: string;
  contact_id?: string;
  attendees?: string[];
  create_meet?: boolean;
}

interface RescheduleAppointmentData {
  tenant_id: string;
  old_appointment_id: string;
  new_start_at: string;
  new_end_at: string;
  reason?: string;
}

interface CancelAppointmentData {
  tenant_id: string;
  appointment_id: string;
  reason?: string;
}

export function useAppointmentOperations() {
  const [isCreating, setIsCreating] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const createAppointment = async (data: CreateAppointmentData) => {
    setIsCreating(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("google-calendar-create", {
        body: data,
      });

      if (error) {
        console.error("Create error:", error);
        toast.error("Errore durante la creazione dell'appuntamento");
        return null;
      }

      if (result?.success) {
        toast.success("Appuntamento creato con successo");
        return result.appointment;
      } else {
        toast.error(result?.error || "Errore durante la creazione");
        return null;
      }
    } catch (error) {
      console.error("Create error:", error);
      toast.error("Errore durante la creazione dell'appuntamento");
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  const rescheduleAppointment = async (data: RescheduleAppointmentData) => {
    setIsRescheduling(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("google-calendar-reschedule", {
        body: data,
      });

      if (error) {
        console.error("Reschedule error:", error);
        toast.error("Errore durante lo spostamento dell'appuntamento");
        return null;
      }

      if (result?.success) {
        toast.success("Appuntamento spostato con successo");
        return result.new_appointment;
      } else {
        toast.error(result?.error || "Errore durante lo spostamento");
        return null;
      }
    } catch (error) {
      console.error("Reschedule error:", error);
      toast.error("Errore durante lo spostamento dell'appuntamento");
      return null;
    } finally {
      setIsRescheduling(false);
    }
  };

  const cancelAppointment = async (data: CancelAppointmentData) => {
    setIsCanceling(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("google-calendar-cancel", {
        body: data,
      });

      if (error) {
        console.error("Cancel error:", error);
        toast.error("Errore durante la cancellazione dell'appuntamento");
        return false;
      }

      if (result?.success) {
        toast.success("Appuntamento cancellato");
        return true;
      } else {
        toast.error(result?.error || "Errore durante la cancellazione");
        return false;
      }
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error("Errore durante la cancellazione dell'appuntamento");
      return false;
    } finally {
      setIsCanceling(false);
    }
  };

  return {
    createAppointment,
    rescheduleAppointment,
    cancelAppointment,
    isCreating,
    isRescheduling,
    isCanceling,
    isLoading: isCreating || isRescheduling || isCanceling,
  };
}
