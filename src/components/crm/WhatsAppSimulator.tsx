import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, RotateCcw, XCircle, Loader2, MessageSquare } from "lucide-react";

interface WhatsAppSimulatorProps {
  tenantId: string;
  leadId: string;
  appointmentId: string | null;
}

export function WhatsAppSimulator({ tenantId, leadId, appointmentId }: WhatsAppSimulatorProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const simulateResponse = async (text: string, buttonId: string) => {
    if (!appointmentId) {
      toast.error("Nessun appuntamento collegato");
      return;
    }

    setIsLoading(buttonId);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-simulate-inbound", {
        body: {
          tenant_id: tenantId,
          lead_id: leadId,
          appointment_id: appointmentId,
          text,
        },
      });

      if (error) throw error;

      // Show appropriate toast based on action taken
      switch (data.action_taken) {
        case "appointment_confirmed":
          toast.success("Appuntamento confermato! Lead passato a gestione HUMAN.");
          break;
        case "reschedule_requested":
          toast.warning("Richiesta spostamento ricevuta. L'appuntamento attende riprogrammazione.");
          break;
        case "appointment_cancelled":
          toast.info("Appuntamento annullato. Lead segnato come LOST.");
          break;
        default:
          toast.success("Messaggio simulato inviato");
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-detail"] });
      queryClient.invalidateQueries({ queryKey: ["lead-appointment"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      queryClient.invalidateQueries({ queryKey: ["interactions"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    } catch (error) {
      console.error("Error simulating WhatsApp:", error);
      toast.error(`Errore: ${error instanceof Error ? error.message : "Simulazione fallita"}`);
    } finally {
      setIsLoading(null);
    }
  };

  if (!appointmentId) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h5 className="text-sm font-medium text-muted-foreground">Simula Risposta WhatsApp</h5>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={() => simulateResponse("CONFERMO", "confirm")}
          disabled={isLoading !== null}
          className="gap-1"
        >
          {isLoading === "confirm" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          CONFERMO
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => simulateResponse("SPOSTA", "reschedule")}
          disabled={isLoading !== null}
          className="gap-1"
        >
          {isLoading === "reschedule" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          SPOSTA
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => simulateResponse("ANNULLA", "cancel")}
          disabled={isLoading !== null}
          className="gap-1"
        >
          {isLoading === "cancel" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          ANNULLA
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Simula la risposta del cliente per testare il flusso di conferma appuntamento.
      </p>
    </div>
  );
}
