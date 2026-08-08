import { useState } from "react";
import { Lead, LeadStatus, useLeads } from "@/hooks/useLeads";
import { useInteractions, InteractionOutcome } from "@/hooks/useInteractions";
import { LeadAppointmentSection } from "./LeadAppointmentSection";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Phone,
  Mail,
  Calendar,
  Clock,
  Star,
  MessageSquare,
  PhoneOff,
  Ban,
  CalendarCheck,
  UserX,
  Check,
  X,
  Plus,
  Loader2,
  Bot,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const outcomeIcons: Record<string, React.ReactNode> = {
  answered: <Phone className="h-3 w-3" />,
  no_answer: <PhoneOff className="h-3 w-3" />,
  opt_out: <Ban className="h-3 w-3" />,
  appointment_set: <CalendarCheck className="h-3 w-3" />,
  none: <MessageSquare className="h-3 w-3" />,
};

const channelLabels: Record<string, string> = {
  call: "Chiamata",
  whatsapp: "WhatsApp",
  email: "Email",
  simulated: "Sistema",
};

export function LeadDetailSheet({ lead, open, onOpenChange }: LeadDetailSheetProps) {
  const { updateLead } = useLeads();
  const { interactions, isLoading: interactionsLoading, createInteraction } = useInteractions(lead?.id || null);
  
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(lead?.notes || "");
  const [newTag, setNewTag] = useState("");
  const [editingTags, setEditingTags] = useState(false);

  if (!lead) return null;

  const handleSaveNotes = () => {
    updateLead.mutate({ leadId: lead.id, updates: { notes } });
    setEditingNotes(false);
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      const updatedTags = [...(lead.tags || []), newTag.trim()];
      updateLead.mutate({ leadId: lead.id, updates: { tags: updatedTags } });
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = (lead.tags || []).filter((t) => t !== tagToRemove);
    updateLead.mutate({ leadId: lead.id, updates: { tags: updatedTags } });
  };

  const handleQuickAction = (
    outcome: InteractionOutcome,
    newStatus: LeadStatus,
    content: string
  ) => {
    createInteraction.mutate({
      leadId: lead.id,
      channel: "simulated",
      direction: "out",
      content,
      outcome,
      newStatus,
    });
  };

  const quickActions = [
    {
      label: "Risposto",
      icon: <Check className="h-4 w-4" />,
      onClick: () => handleQuickAction("answered", "IN_CONVO", "Ha risposto alla chiamata"),
      variant: "default" as const,
    },
    {
      label: "Non risponde",
      icon: <PhoneOff className="h-4 w-4" />,
      onClick: () => handleQuickAction("no_answer", "NO_ANSWER", "Non ha risposto"),
      variant: "secondary" as const,
    },
    {
      label: "STOP",
      icon: <Ban className="h-4 w-4" />,
      onClick: () => handleQuickAction("opt_out", "DO_NOT_CONTACT", "Ha richiesto di non essere contattato"),
      variant: "destructive" as const,
    },
    {
      label: "Appuntamento",
      icon: <CalendarCheck className="h-4 w-4" />,
      onClick: () => handleQuickAction("appointment_set", "APPOINTMENT_SET", "Appuntamento fissato"),
      variant: "default" as const,
    },
    {
      label: "Perso",
      icon: <UserX className="h-4 w-4" />,
      onClick: () => handleQuickAction("none", "LOST", "Lead perso"),
      variant: "outline" as const,
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {lead.name}
            <div className="flex items-center gap-1 text-yellow-400">
              <Star className="h-4 w-4" />
              <span className="text-sm">{lead.priority_score}</span>
            </div>
            {(lead as Lead & { handoff_status?: string }).handoff_status && (
              <Badge variant="outline" className="gap-1 text-xs">
                {(lead as Lead & { handoff_status?: string }).handoff_status === "AI" ? (
                  <Bot className="h-3 w-3" />
                ) : (
                  <User className="h-3 w-3" />
                )}
                {(lead as Lead & { handoff_status?: string }).handoff_status}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Contact Info */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Contatti</h4>
              <div className="space-y-1">
                {lead.phone_e164 && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.phone_e164}</span>
                  </div>
                )}
                {lead.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.email}</span>
                  </div>
                )}
                {lead.next_action_at && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Prossima azione: {format(new Date(lead.next_action_at), "dd MMM yyyy HH:mm", { locale: it })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Quick Actions */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Azioni Rapide</h4>
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant={action.variant}
                    size="sm"
                    onClick={action.onClick}
                    disabled={createInteraction.isPending}
                  >
                    {action.icon}
                    <span className="ml-1">{action.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Form Payload */}
            {lead.form_payload && Object.keys(lead.form_payload).length > 0 && (
              <>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Dati Form</h4>
                  <div className="bg-muted rounded-lg p-3 space-y-1">
                    {Object.entries(lead.form_payload).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Tags */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">Tags</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingTags(!editingTags)}
                >
                  {editingTags ? "Fatto" : "Modifica"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(lead.tags || []).map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    {editingTags && (
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => handleRemoveTag(tag)}
                      />
                    )}
                  </Badge>
                ))}
                {editingTags && (
                  <div className="flex items-center gap-1">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Nuovo tag"
                      className="h-7 w-24"
                      onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAddTag}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">Note</h4>
                {editingNotes ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                      Annulla
                    </Button>
                    <Button size="sm" onClick={handleSaveNotes}>
                      Salva
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => {
                    setNotes(lead.notes || "");
                    setEditingNotes(true);
                  }}>
                    Modifica
                  </Button>
                )}
              </div>
              {editingNotes ? (
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Aggiungi note..."
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {lead.notes || "Nessuna nota"}
                </p>
              )}
            </div>

            <Separator />

            {/* Appointment Section */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Appuntamento</h4>
              <LeadAppointmentSection leadId={lead.id} />
            </div>

            <Separator />

            {/* Interactions */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Storico Interazioni</h4>
              {interactionsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : interactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessuna interazione</p>
              ) : (
                <div className="space-y-3">
                  {interactions.map((interaction) => (
                    <div
                      key={interaction.id}
                      className="flex gap-3 p-3 bg-muted rounded-lg"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {outcomeIcons[interaction.outcome || "none"]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{channelLabels[interaction.channel]}</span>
                          <span>•</span>
                          <span>
                            {format(new Date(interaction.created_at), "dd MMM HH:mm", { locale: it })}
                          </span>
                        </div>
                        {interaction.content && (
                          <p className="text-sm mt-1">{interaction.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
