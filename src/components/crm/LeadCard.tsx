import { Lead } from "@/hooks/useLeads";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Clock, Star, Bot, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface LeadCardProps {
  lead: Lead & { 
    handoff_status?: string; 
    appointment_id?: string;
    appointment?: { status: string } | null;
  };
  onClick: () => void;
  isDragging?: boolean;
}

const sourceColors: Record<string, string> = {
  facebook_ads: "bg-blue-500/20 text-blue-400",
  website_form: "bg-green-500/20 text-green-400",
  referral: "bg-purple-500/20 text-purple-400",
  manual: "bg-gray-500/20 text-gray-400",
  import: "bg-orange-500/20 text-orange-400",
};

const appointmentStatusConfig: Record<string, { label: string; className: string }> = {
  scheduled: { label: "In Attesa", className: "bg-yellow-500/20 text-yellow-400" },
  confirmed: { label: "Confermato", className: "bg-green-500/20 text-green-400" },
  cancelled: { label: "Annullato", className: "bg-red-500/20 text-red-400" },
  completed: { label: "Completato", className: "bg-blue-500/20 text-blue-400" },
  no_show: { label: "No Show", className: "bg-orange-500/20 text-orange-400" },
  rescheduled: { label: "Riprog.", className: "bg-purple-500/20 text-purple-400" },
};

export function LeadCard({ lead, onClick, isDragging }: LeadCardProps) {
  const priorityColor = 
    lead.priority_score >= 80 ? "text-red-400" :
    lead.priority_score >= 50 ? "text-yellow-400" :
    "text-muted-foreground";

  const appointmentStatus = lead.appointment?.status;
  const apptConfig = appointmentStatus ? appointmentStatusConfig[appointmentStatus] : null;

  return (
    <Card
      onClick={onClick}
      className={`p-3 cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${
        isDragging ? "opacity-50 rotate-2 scale-105" : ""
      }`}
    >
      <div className="space-y-2">
        {/* Header: Name + Priority */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm truncate flex-1">{lead.name}</h4>
          <div className={`flex items-center gap-1 ${priorityColor}`}>
            <Star className="h-3 w-3" />
            <span className="text-xs font-medium">{lead.priority_score}</span>
          </div>
        </div>

        {/* Badges: Handoff + Appointment Status */}
        <div className="flex flex-wrap gap-1">
          {lead.handoff_status && (
            <Badge variant="outline" className="text-xs py-0 gap-1">
              {lead.handoff_status === "AI" ? (
                <Bot className="h-2.5 w-2.5" />
              ) : (
                <User className="h-2.5 w-2.5" />
              )}
              {lead.handoff_status}
            </Badge>
          )}
          {apptConfig && (
            <Badge className={`text-xs py-0 gap-1 ${apptConfig.className}`}>
              <Calendar className="h-2.5 w-2.5" />
              {apptConfig.label}
            </Badge>
          )}
        </div>

        {/* Contact info */}
        <div className="space-y-1 text-xs text-muted-foreground">
          {lead.phone_e164 && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" />
              <span className="truncate">{lead.phone_e164}</span>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
        </div>

        {/* Source + Next action */}
        <div className="flex items-center justify-between gap-2">
          {lead.source && (
            <Badge 
              variant="secondary" 
              className={`text-xs ${sourceColors[lead.source] || "bg-muted"}`}
            >
              {lead.source}
            </Badge>
          )}
          {lead.next_action_at && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {format(new Date(lead.next_action_at), "dd MMM HH:mm", { locale: it })}
              </span>
            </div>
          )}
        </div>

        {/* Tags */}
        {lead.tags && lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {lead.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs py-0">
                {tag}
              </Badge>
            ))}
            {lead.tags.length > 3 && (
              <Badge variant="outline" className="text-xs py-0">
                +{lead.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
