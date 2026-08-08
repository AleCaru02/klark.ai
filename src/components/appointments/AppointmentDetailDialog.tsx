import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Loader2, 
  Calendar, 
  Clock, 
  MapPin, 
  Video, 
  User, 
  Phone,
  MoveRight,
  Trash2,
  ExternalLink,
  Copy,
  Check
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Appointment {
  id: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  duration: number;
  status: "scheduled" | "rescheduled" | "canceled" | "confirmed" | "completed" | "no_show";
  hasMeet: boolean;
  meet_link: string | null;
  title?: string;
  description?: string;
  location?: string;
}

interface AppointmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onReschedule: () => void;
  onCancel: () => void;
  isCanceling: boolean;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "In Attesa", variant: "default" },
  rescheduled: { label: "Spostato", variant: "secondary" },
  canceled: { label: "Cancellato", variant: "destructive" },
  confirmed: { label: "Confermato", variant: "default" },
  completed: { label: "Completato", variant: "outline" },
  no_show: { label: "No Show", variant: "destructive" },
};

// Helper to format long URLs into readable short text
function formatLinkDisplay(url: string): string {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace("www.", "");
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length > 2) {
      return `${domain}/.../${pathParts[pathParts.length - 1].substring(0, 15)}`;
    }
    return `${domain}${parsed.pathname.substring(0, 30)}${parsed.pathname.length > 30 ? "..." : ""}`;
  } catch {
    return url.substring(0, 40) + (url.length > 40 ? "..." : "");
  }
}

export function AppointmentDetailDialog({
  open,
  onOpenChange,
  appointment,
  onReschedule,
  onCancel,
  isCanceling,
}: AppointmentDetailDialogProps) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  if (!appointment) return null;

  const statusInfo = statusLabels[appointment.status];
  const isCanceled = appointment.status === "canceled";

  const formatDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return format(date, "EEEE d MMMM yyyy", { locale: it });
    } catch {
      return dateStr;
    }
  };

  const handleCancelClick = () => {
    if (confirmCancel) {
      onCancel();
      setConfirmCancel(false);
    } else {
      setConfirmCancel(true);
    }
  };

  const handleDialogClose = (isOpen: boolean) => {
    if (!isOpen) {
      setConfirmCancel(false);
      setCopiedLink(null);
    }
    onOpenChange(isOpen);
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(url);
      toast.success("Link copiato!");
      setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      toast.error("Impossibile copiare il link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="w-[min(720px,92vw)] max-w-[min(720px,92vw)] overflow-x-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="min-w-0 pr-10">
          <DialogTitle className="flex flex-wrap items-start gap-2 min-w-0">
            <span 
              className="whitespace-normal break-words min-w-0 flex-1"
              style={{ overflowWrap: "anywhere" }}
            >
              {appointment.title || appointment.name}
            </span>
            <Badge variant={statusInfo.variant} className="shrink-0">
              {statusInfo.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Dettagli dell'appuntamento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
          {/* Contact info */}
          <div className="flex items-start gap-3 text-sm min-w-0">
            <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <span 
              className="font-medium whitespace-normal min-w-0"
              style={{ overflowWrap: "anywhere" }}
            >
              {appointment.name}
            </span>
          </div>
          
          {appointment.phone && (
            <div className="flex items-start gap-3 text-sm min-w-0">
              <Phone className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <span 
                className="whitespace-normal min-w-0"
                style={{ overflowWrap: "anywhere" }}
              >
                {appointment.phone}
              </span>
            </div>
          )}

          <Separator />

          {/* Date and time */}
          <div className="flex items-start gap-3 text-sm min-w-0">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="capitalize whitespace-normal min-w-0">
              {formatDate(appointment.date)}
            </span>
          </div>

          <div className="flex items-start gap-3 text-sm min-w-0">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="whitespace-normal min-w-0">
              {appointment.time} ({appointment.duration} min)
            </span>
          </div>

          {/* Location */}
          {appointment.location && (
            <div className="flex items-start gap-3 text-sm min-w-0">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <span 
                className="whitespace-normal min-w-0"
                style={{ overflowWrap: "anywhere" }}
              >
                {appointment.location}
              </span>
            </div>
          )}

          {/* Meet link */}
          {appointment.hasMeet && appointment.meet_link && (
            <div className="flex items-start gap-3 text-sm min-w-0">
              <Video className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <a 
                  href={appointment.meet_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1 break-all"
                  style={{ overflowWrap: "anywhere" }}
                >
                  {formatLinkDisplay(appointment.meet_link)}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 shrink-0"
                  onClick={() => handleCopyLink(appointment.meet_link!)}
                >
                  {copiedLink === appointment.meet_link ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Description - show only link if present */}
          {appointment.description && (() => {
            const urlMatch = appointment.description.match(/https?:\/\/[^\s<>"]+/);
            if (urlMatch) {
              return (
                <>
                  <Separator />
                  <div className="flex items-start gap-3 text-sm min-w-0">
                    <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <a 
                        href={urlMatch[0]} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {formatLinkDisplay(urlMatch[0])}
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 shrink-0"
                        onClick={() => handleCopyLink(urlMatch[0])}
                      >
                        {copiedLink === urlMatch[0] ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              );
            }
            return null;
          })()}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 shrink-0">
          {!isCanceled && (
            <>
              {confirmCancel ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setConfirmCancel(false)}
                    disabled={isCanceling}
                  >
                    Annulla
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleCancelClick}
                    disabled={isCanceling}
                    className="flex-1 sm:flex-none"
                  >
                    {isCanceling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Conferma cancellazione"
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    onClick={handleCancelClick}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Cancella
                  </Button>
                  <Button onClick={onReschedule}>
                    <MoveRight className="w-4 h-4 mr-2" />
                    Sposta
                  </Button>
                </>
              )}
            </>
          )}
          {isCanceled && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Chiudi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
