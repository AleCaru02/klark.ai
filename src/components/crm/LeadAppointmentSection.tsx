import { useLeadAppointment } from "@/hooks/useAppointments";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { useAuth } from "@/contexts/AuthContext";
import { WhatsAppSimulator } from "./WhatsAppSimulator";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Send,
  Inbox,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface LeadAppointmentSectionProps {
  leadId: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  scheduled: { label: "In Attesa", color: "bg-yellow-500", icon: <AlertCircle className="h-3 w-3" /> },
  confirmed: { label: "Confermato", color: "bg-green-500", icon: <CheckCircle className="h-3 w-3" /> },
  cancelled: { label: "Annullato", color: "bg-red-500", icon: <XCircle className="h-3 w-3" /> },
  completed: { label: "Completato", color: "bg-blue-500", icon: <CheckCircle className="h-3 w-3" /> },
  no_show: { label: "No Show", color: "bg-orange-500", icon: <XCircle className="h-3 w-3" /> },
  rescheduled: { label: "Riprogrammato", color: "bg-purple-500", icon: <AlertCircle className="h-3 w-3" /> },
};

const messageTypeLabels: Record<string, string> = {
  confirm_now: "Conferma",
  reminder_24h: "Promemoria 24h",
  reminder_2h: "Promemoria 2h",
  reply: "Risposta",
  reschedule: "Riprogramma",
  cancel: "Annulla",
  other: "Altro",
};

export function LeadAppointmentSection({ leadId }: LeadAppointmentSectionProps) {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const { appointment, isLoading: appointmentLoading } = useLeadAppointment(leadId);
  const { messages, isLoading: messagesLoading } = useWhatsAppMessages(leadId);

  if (appointmentLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Nessun appuntamento programmato
      </div>
    );
  }

  const status = statusConfig[appointment.status || "scheduled"] || statusConfig.scheduled;

  return (
    <div className="space-y-4">
      {/* Appointment Details */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="font-medium">Appuntamento</h5>
          <Badge className={`${status.color} text-white gap-1`}>
            {status.icon}
            {status.label}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              {format(new Date(appointment.start_at), "EEEE d MMMM yyyy", { locale: it })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {format(new Date(appointment.start_at), "HH:mm", { locale: it })} -{" "}
              {format(new Date(appointment.end_at), "HH:mm", { locale: it })}
            </span>
          </div>

          {appointment.meeting_type === "online" && appointment.meet_link ? (
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              <a
                href={appointment.meet_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline truncate"
              >
                {appointment.meet_link}
              </a>
            </div>
          ) : appointment.meeting_type === "in_person" && appointment.location ? (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{appointment.location}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {appointment.meeting_type === "online" ? (
                <Video className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Users className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="capitalize">{appointment.meeting_type || "Online"}</span>
            </div>
          )}

          {appointment.confirmation_deadline_at && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>
                Scadenza conferma:{" "}
                {format(new Date(appointment.confirmation_deadline_at), "dd/MM HH:mm", { locale: it })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Simulator */}
      {tenantId && (
        <>
          <Separator />
          <WhatsAppSimulator
            tenantId={tenantId}
            leadId={leadId}
            appointmentId={appointment.id}
          />
        </>
      )}

      {/* WhatsApp Messages */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h5 className="text-sm font-medium text-muted-foreground">Messaggi WhatsApp</h5>
        </div>

        {messagesLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            Nessun messaggio
          </p>
        ) : (
          <ScrollArea className="h-[150px]">
            <div className="space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 p-2 rounded-lg text-sm ${
                    msg.direction === "out" ? "bg-primary/10 ml-4" : "bg-muted mr-4"
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {msg.direction === "out" ? (
                      <Send className="h-3 w-3 text-primary" />
                    ) : (
                      <Inbox className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{messageTypeLabels[msg.message_type || "other"]}</span>
                      <span>•</span>
                      <span>{format(new Date(msg.ts), "dd/MM HH:mm")}</span>
                      {msg.delivery_status && msg.delivery_status !== "received" && (
                        <>
                          <span>•</span>
                          <span
                            className={
                              msg.delivery_status === "failed"
                                ? "text-destructive"
                                : msg.delivery_status === "simulated"
                                ? "text-yellow-600"
                                : ""
                            }
                          >
                            {msg.delivery_status === "simulated" ? "SIMULATO" : msg.delivery_status}
                          </span>
                        </>
                      )}
                    </div>
                    {msg.text && <p className="mt-1 break-words">{msg.text}</p>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
