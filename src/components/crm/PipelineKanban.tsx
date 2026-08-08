import { useState, useEffect } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Phone, Mail, GripVertical, Plus, PhoneOff } from "lucide-react";
import { ContactWithDetails, Stage } from "@/hooks/useCRM";
import { cn } from "@/lib/utils";

interface PipelineKanbanProps {
  stages: Stage[];
  contacts: ContactWithDetails[];
  onMoveContact: (contactId: string, stageId: string) => void;
  onViewContact: (contact: ContactWithDetails) => void;
  onCreateContact: () => void;
  getContactsByStage: (stageId: string) => ContactWithDetails[];
  getContactsWithoutStage: () => ContactWithDetails[];
  contactQueueMap?: Map<string, { attempt_count: number; max_attempts: number; status: string; next_attempt_at: string | null }>;
}

export function PipelineKanban({
  stages,
  contacts,
  onMoveContact,
  onViewContact,
  onCreateContact,
  getContactsByStage,
  getContactsWithoutStage,
  contactQueueMap,
}: PipelineKanbanProps) {
  const [draggedContact, setDraggedContact] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Auto-assign contacts without stage to first stage (via effect, not during render)
  useEffect(() => {
    const unassigned = getContactsWithoutStage();
    if (unassigned.length > 0 && stages.length > 0) {
      unassigned.forEach((contact) => {
        onMoveContact(contact.id, stages[0].id);
      });
    }
  }, [contacts, stages]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragStart = (e: React.DragEvent, contactId: string) => {
    setDraggedContact(contactId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(stageId);
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (draggedContact) {
      onMoveContact(draggedContact, stageId);
    }
    setDraggedContact(null);
    setDragOverStage(null);
  };

  const handleDragEnd = () => {
    setDraggedContact(null);
    setDragOverStage(null);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)] overflow-x-auto pb-4">
      {stages.map((stage, index) => {
        const stageContacts = getContactsByStage(stage.id);
        const isOver = dragOverStage === stage.id;

        return (
          <div
            key={stage.id}
            className={cn(
              "flex-shrink-0 w-[320px] bg-muted/30 rounded-xl border-t-4 transition-all",
              isOver && "ring-2 ring-primary ring-offset-2"
            )}
            style={{ borderTopColor: stage.color }}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            <div className="p-4 border-b bg-card/50 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  <h3 className="font-semibold">{stage.name}</h3>
                </div>
                <Badge variant="secondary">{stageContacts.length}</Badge>
              </div>
            </div>

            <ScrollArea className="h-[calc(100%-60px)]">
              <div className="p-3 space-y-3">
                {stageContacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Nessun contatto
                  </div>
                ) : (
                  stageContacts.map((contact) => (
                    <Card
                      key={contact.id}
                      className={cn(
                        "cursor-grab active:cursor-grabbing transition-all hover:shadow-md",
                        draggedContact === contact.id && "opacity-50 scale-95"
                      )}
                      draggable
                      onDragStart={(e) => handleDragStart(e, contact.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onViewContact(contact)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{contact.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(contact.created_at), "d MMM", { locale: it })}
                                </p>
                              </div>
                            </div>

                            <div className="mt-2 space-y-1">
                              {contact.phone_e164 && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                  <Phone className="h-3 w-3 flex-shrink-0" />
                                  {contact.phone_e164}
                                </p>
                              )}
                              {contact.email && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                  <Mail className="h-3 w-3 flex-shrink-0" />
                                  {contact.email}
                                </p>
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1">
                              {contact.contact_sources?.[0]?.source && (
                                <Badge variant="outline" className="text-xs">
                                  {contact.contact_sources[0].source === "facebook_leadads"
                                    ? "Facebook"
                                    : contact.contact_sources[0].source === "contact_form"
                                    ? "Form"
                                    : contact.contact_sources[0].source === "import"
                                    ? "Import"
                                    : "Manuale"}
                                </Badge>
                              )}
                              {(() => {
                                const queueInfo = contactQueueMap?.get(contact.id);
                                if (!queueInfo) return null;
                                if (queueInfo.status === "completed" || queueInfo.status === "booked") {
                                  return (
                                    <Badge variant="default" className="text-xs bg-success/10 text-success border-success/20">
                                      ✓
                                    </Badge>
                                  );
                                }
                                if (queueInfo.attempt_count > 0) {
                                  return (
                                    <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                                      <PhoneOff className="h-2 w-2 mr-0.5" />
                                      {queueInfo.attempt_count}/{queueInfo.max_attempts}
                                    </Badge>
                                  );
                                }
                                return (
                                  <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                                    Coda
                                  </Badge>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}

                {index === 0 && (
                  <Button
                    variant="ghost"
                    className="w-full border-2 border-dashed"
                    onClick={onCreateContact}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nuovo Lead
                  </Button>
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
