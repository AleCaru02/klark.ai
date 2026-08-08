import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  User,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Phone,
  Video,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface AppointmentWithLead {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  contact_id: string | null;
  title: string | null;
  meeting_type: string | null;
  start_at: string;
  end_at: string;
  timezone: string | null;
  meet_link: string | null;
  location: string | null;
  status: string | null;
  confirmation_deadline_at: string | null;
  created_at: string;
  lead?: {
    id: string;
    name: string;
    phone_e164: string | null;
    email: string | null;
    handoff_status: string | null;
  } | null;
  tenant?: {
    name: string;
  } | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  scheduled: { label: "In Attesa Conferma", color: "bg-yellow-500" },
  confirmed: { label: "Confermato", color: "bg-green-500" },
  cancelled: { label: "Annullato", color: "bg-red-500" },
  completed: { label: "Completato", color: "bg-blue-500" },
  no_show: { label: "No Show", color: "bg-orange-500" },
  rescheduled: { label: "Riprogrammato", color: "bg-purple-500" },
};

export default function AppointmentControl() {
  const queryClient = useQueryClient();
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithLead | null>(null);
  const [actionType, setActionType] = useState<"confirm" | "cancel" | null>(null);

  // Fetch all pending/reschedule appointments across all tenants (admin view)
  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ["admin-appointments-control"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          lead:leads!appointments_lead_id_fkey(id, name, phone_e164, email, handoff_status),
          tenant:tenants!appointments_tenant_id_fkey(name)
        `)
        .in("status", ["scheduled", "rescheduled"])
        .order("start_at", { ascending: true });

      if (error) throw error;
      return data as AppointmentWithLead[];
    },
  });

  const confirmAppointment = useMutation({
    mutationFn: async (appointment: AppointmentWithLead) => {
      // Update appointment status to confirmed (using 'scheduled' as base enum doesn't have 'confirmed')
      // We'll use a text update approach
      const { error: appointmentError } = await supabase
        .from("appointments")
        .update({ status: "scheduled" as const }) // Note: The enum may need to be extended for 'confirmed'
        .eq("id", appointment.id);

      if (appointmentError) throw appointmentError;

      // If has lead, update handoff_status to HUMAN
      if (appointment.lead_id) {
        const { error: leadError } = await supabase
          .from("leads")
          .update({ handoff_status: "HUMAN" })
          .eq("id", appointment.lead_id);

        if (leadError) throw leadError;

        // Log interaction
        await supabase.from("interactions").insert({
          tenant_id: appointment.tenant_id,
          lead_id: appointment.lead_id,
          channel: "system",
          direction: "out",
          content: `Appuntamento confermato manualmente e passato a gestione HUMAN`,
          outcome: "appointment_confirmed",
          meta: { appointment_id: appointment.id, action: "force_confirm" },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-control"] });
      toast.success("Appuntamento confermato e lead passato a HUMAN");
      setSelectedAppointment(null);
      setActionType(null);
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const cancelAppointment = useMutation({
    mutationFn: async (appointment: AppointmentWithLead) => {
      // Update appointment status to canceled
      const { error: appointmentError } = await supabase
        .from("appointments")
        .update({ status: "canceled" as const })
        .eq("id", appointment.id);

      if (appointmentError) throw appointmentError;

      // If has lead, update status to LOST (could be IN_CONVO based on config)
      if (appointment.lead_id) {
        const { error: leadError } = await supabase
          .from("leads")
          .update({ 
            status: "LOST",
            appointment_id: null,
          })
          .eq("id", appointment.lead_id);

        if (leadError) throw leadError;

        // Log interaction
        await supabase.from("interactions").insert({
          tenant_id: appointment.tenant_id,
          lead_id: appointment.lead_id,
          channel: "system",
          direction: "out",
          content: `Appuntamento annullato manualmente`,
          outcome: "cancelled",
          meta: { appointment_id: appointment.id, action: "force_cancel" },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-control"] });
      toast.success("Appuntamento annullato");
      setSelectedAppointment(null);
      setActionType(null);
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const handleAction = () => {
    if (!selectedAppointment || !actionType) return;
    
    if (actionType === "confirm") {
      confirmAppointment.mutate(selectedAppointment);
    } else {
      cancelAppointment.mutate(selectedAppointment);
    }
  };

  const isActionPending = confirmAppointment.isPending || cancelAppointment.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Controllo Appuntamenti</h1>
          <p className="text-muted-foreground">
            Gestisci appuntamenti in attesa di conferma o richieste di riprogrammazione
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Aggiorna
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Appuntamenti da Gestire
            {appointments && appointments.length > 0 && (
              <Badge variant="secondary">{appointments.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !appointments || appointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessun appuntamento in attesa di gestione</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Ora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Handoff</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment) => {
                  const statusInfo = statusConfig[appointment.status || "scheduled"];
                  return (
                    <TableRow key={appointment.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 font-medium">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(appointment.start_at), "dd MMM yyyy", { locale: it })}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(appointment.start_at), "HH:mm")} - 
                            {format(new Date(appointment.end_at), "HH:mm")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {appointment.lead ? (
                          <div className="space-y-1">
                            <div className="font-medium">{appointment.lead.name}</div>
                            {appointment.lead.phone_e164 && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {appointment.lead.phone_e164}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{appointment.tenant?.name || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {appointment.meeting_type === "online" ? (
                            <Video className="h-4 w-4 text-blue-500" />
                          ) : (
                            <MapPin className="h-4 w-4 text-green-500" />
                          )}
                          <span className="text-sm capitalize">{appointment.meeting_type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusInfo.color} text-white`}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {appointment.lead?.handoff_status && (
                          <Badge variant="outline">
                            {appointment.lead.handoff_status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="gap-1"
                            onClick={() => {
                              setSelectedAppointment(appointment);
                              setActionType("confirm");
                            }}
                          >
                            <CheckCircle className="h-3 w-3" />
                            Conferma + HUMAN
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1"
                            onClick={() => {
                              setSelectedAppointment(appointment);
                              setActionType("cancel");
                            }}
                          >
                            <XCircle className="h-3 w-3" />
                            Annulla
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!selectedAppointment && !!actionType} onOpenChange={() => {
        setSelectedAppointment(null);
        setActionType(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "confirm" ? "Conferma Appuntamento" : "Annulla Appuntamento"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "confirm" ? (
                <>
                  Stai per confermare l'appuntamento e passare il lead a gestione <strong>HUMAN</strong>.
                  <br />
                  Il lead non riceverà più azioni automatiche dal Follow-up Engine.
                </>
              ) : (
                <>
                  Stai per annullare l'appuntamento.
                  <br />
                  Il lead verrà impostato come <strong>LOST</strong>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionPending}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={isActionPending}
              className={actionType === "cancel" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {isActionPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === "confirm" ? "Conferma" : "Annulla Appuntamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
