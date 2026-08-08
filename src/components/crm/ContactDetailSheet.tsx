import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Phone,
  Mail,
  Calendar,
  MessageCircle,
  PhoneCall,
  FileText,
  ChevronRight,
  Send,
  Edit2,
  Save,
  X,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { useContactDetails, Stage } from "@/hooks/useCRM";
import { useCallRecaps } from "@/hooks/useCallRecaps";
import { CreateAppointmentDialog } from "@/components/crm/CreateAppointmentDialog";
import { cn } from "@/lib/utils";

interface ContactDetailSheetProps {
  contactId: string | null;
  stages: Stage[];
  onClose: () => void;
  onMoveToStage: (contactId: string, stageId: string) => void;
}

const sourceLabels: Record<string, string> = {
  facebook_leadads: "Facebook Lead Ads",
  contact_form: "Form Contatto",
  manual: "Manuale",
  import: "Importato",
};

export function ContactDetailSheet({
  contactId,
  stages,
  onClose,
  onMoveToStage,
}: ContactDetailSheetProps) {
  const { contact, isLoading, activityLog, addNote, updateContact } = useContactDetails(contactId);
  const { latestRecap, generateRecap, isLoading: recapsLoading } = useCallRecaps(contactId);
  const [newNote, setNewNote] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [showCallInput, setShowCallInput] = useState(false);
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "" });

  const handleStartEdit = () => {
    if (contact) {
      setEditForm({
        name: contact.name || "",
        phone: contact.phone_e164 || "",
        email: contact.email || "",
      });
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    await updateContact.mutateAsync({
      name: editForm.name,
      phone_e164: editForm.phone || null,
      email: editForm.email || null,
    });
    setIsEditing(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await addNote.mutateAsync(newNote);
    setNewNote("");
  };

  const handleGenerateRecap = async (regenerate = false) => {
    if (!callNotes.trim() && !regenerate) return;
    await generateRecap.mutateAsync({
      callNotes: callNotes || undefined,
      regenerate,
    });
    setCallNotes("");
    setShowCallInput(false);
  };

  const currentStageId = contact?.contact_stages?.[0]?.stage_id;
  const currentStage = stages.find((s) => s.id === currentStageId);

  const formAnswers = contact?.lead_form_answers?.[0]?.answers_json as Record<string, string> | undefined;
  const notes = contact?.lead_notes || [];

  const priorityColors = {
    alta: "bg-red-500/10 text-red-600 border-red-500/20",
    media: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    bassa: "bg-green-500/10 text-green-600 border-green-500/20",
  };

  const nextStepIcons: Record<string, React.ReactNode> = {
    "appuntamento fissato": <Calendar className="h-3 w-3" />,
    "cliente confermato": <CheckCircle2 className="h-3 w-3" />,
    "richiamare": <Clock className="h-3 w-3" />,
    "non interessato": <X className="h-3 w-3" />,
    "altro": <AlertTriangle className="h-3 w-3" />,
  };

  return (
    <Sheet open={!!contactId} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-0">
          <div className="flex items-start justify-between">
            <SheetTitle className="text-xl">Dettagli Contatto</SheetTitle>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : contact ? (
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Contact Header */}
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Nome"
                      />
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="Telefono"
                      />
                      <Input
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="Email"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit} disabled={updateContact.isPending}>
                          <Save className="h-4 w-4 mr-1" />
                          Salva
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                          <X className="h-4 w-4 mr-1" />
                          Annulla
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold">{contact.name}</h2>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleStartEdit}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {contact.phone_e164 && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3" />
                          {contact.phone_e164}
                        </p>
                      )}
                      {contact.email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </p>
                      )}
                    </>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    {contact.contact_sources?.[0]?.source && (
                      <Badge variant="outline">
                        {sourceLabels[contact.contact_sources[0].source]}
                      </Badge>
                    )}
                    {currentStage && <Badge variant="secondary">{currentStage.name}</Badge>}
                  </div>
                </div>
              </div>

              {/* Stage Actions */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Sposta a</CardTitle>
                </CardHeader>
                <CardContent className="py-0 pb-3">
                  <div className="flex flex-wrap gap-2">
                    {stages.map((stage) => (
                      <Button
                        key={stage.id}
                        size="sm"
                        variant={stage.id === currentStageId ? "default" : "outline"}
                        onClick={() => {
                          if (contactId && stage.id !== currentStageId) {
                            onMoveToStage(contactId, stage.id);
                          }
                        }}
                        disabled={stage.id === currentStageId}
                      >
                        {stage.name}
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Appointment Button */}
              <Button
                onClick={() => setShowAppointmentDialog(true)}
                className="w-full"
                variant="outline"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Fissa Appuntamento
              </Button>

              {/* Call Recap Section */}
              <Card className="border-primary/20">
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Recap Chiamata (AI)
                    </CardTitle>
                    {latestRecap && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleGenerateRecap(true)}
                        disabled={generateRecap.isPending}
                      >
                        {generateRecap.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        <span className="ml-1">Rigenera</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="py-0 pb-3 space-y-3">
                  {latestRecap ? (
                    <>
                      {/* Priority & Next Step */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={priorityColors[latestRecap.priority]}>
                          Priorità: {latestRecap.priority}
                        </Badge>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          {nextStepIcons[latestRecap.next_step]}
                          {latestRecap.next_step}
                        </Badge>
                      </div>

                      {/* Summary Bullets */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Punti chiave</Label>
                        <ul className="text-sm space-y-1 list-disc list-inside">
                          {(latestRecap.summary_bullets_json || []).map((bullet, idx) => (
                            <li key={idx} className="text-muted-foreground">{bullet}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Objections */}
                      {latestRecap.objections && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Obiezioni</Label>
                          <p className="text-sm text-orange-600">{latestRecap.objections}</p>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Generato: {format(new Date(latestRecap.created_at), "d MMM yyyy HH:mm", { locale: it })}
                      </p>
                    </>
                  ) : (
                    <>
                      {!showCallInput ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setShowCallInput(true)}
                        >
                          <PhoneCall className="h-4 w-4 mr-2" />
                          Inserisci esito chiamata
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <Textarea
                            placeholder="Descrivi l'esito della chiamata: cosa è stato discusso, quali sono le esigenze del lead, prossimi passi concordati..."
                            value={callNotes}
                            onChange={(e) => setCallNotes(e.target.value)}
                            className="min-h-[100px]"
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleGenerateRecap(false)}
                              disabled={!callNotes.trim() || generateRecap.isPending}
                              className="flex-1"
                            >
                              {generateRecap.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Generazione...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  Genera Recap AI
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowCallInput(false);
                                setCallNotes("");
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Tabs defaultValue="notes">
                <TabsList className="w-full">
                  <TabsTrigger value="notes" className="flex-1">
                    <FileText className="h-4 w-4 mr-2" />
                    Note
                  </TabsTrigger>
                  <TabsTrigger value="form" className="flex-1">
                    <FileText className="h-4 w-4 mr-2" />
                    Modulo
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="flex-1">
                    <Calendar className="h-4 w-4 mr-2" />
                    Attività
                  </TabsTrigger>
                </TabsList>

                {/* Notes Tab */}
                <TabsContent value="notes" className="mt-4 space-y-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Scrivi una nota..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                  <Button onClick={handleAddNote} disabled={!newNote.trim() || addNote.isPending}>
                    <Send className="h-4 w-4 mr-2" />
                    Aggiungi Nota
                  </Button>

                  <Separator />

                  {notes.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">Nessuna nota</p>
                  ) : (
                    <div className="space-y-3">
                      {notes.map((note: any) => (
                        <Card key={note.id}>
                          <CardContent className="p-3">
                            <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {format(new Date(note.created_at), "d MMM yyyy HH:mm", { locale: it })}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Form Answers Tab */}
                <TabsContent value="form" className="mt-4">
                  {formAnswers && Object.keys(formAnswers).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(formAnswers).map(([key, value]) => (
                        <div key={key} className="flex flex-col gap-1">
                          <Label className="text-xs text-muted-foreground">{key}</Label>
                          <p className="text-sm">{value || "-"}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      Nessun dato dal modulo
                    </p>
                  )}
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity" className="mt-4">
                  {activityLog.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      Nessuna attività registrata
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {activityLog.map((activity) => (
                        <Card key={`${activity.type}-${activity.id}`}>
                          <CardContent className="p-3 flex items-start gap-3">
                            <div
                              className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                                activity.type === "call" && "bg-green-500/10 text-green-600",
                                activity.type === "message" && "bg-blue-500/10 text-blue-600",
                                activity.type === "appointment" && "bg-purple-500/10 text-purple-600"
                              )}
                            >
                              {activity.type === "call" && <PhoneCall className="h-4 w-4" />}
                              {activity.type === "message" && <MessageCircle className="h-4 w-4" />}
                              {activity.type === "appointment" && <Calendar className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">
                                {activity.type === "call" && "Chiamata"}
                                {activity.type === "message" &&
                                  `Messaggio: ${activity.data.template_name || "N/A"}`}
                                {activity.type === "appointment" &&
                                  `Appuntamento: ${activity.data.title || "Senza titolo"}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(activity.created_at), "d MMM yyyy HH:mm", {
                                  locale: it,
                                })}
                              </p>
                              {activity.type === "call" && activity.data.connected_seconds && (
                                <p className="text-xs text-muted-foreground">
                                  Durata: {Math.floor(activity.data.connected_seconds / 60)}:
                                  {String(activity.data.connected_seconds % 60).padStart(2, "0")}
                                </p>
                              )}
                              {activity.type === "appointment" && (
                                <Badge
                                  variant={
                                    activity.data.status === "canceled"
                                      ? "destructive"
                                      : activity.data.status === "rescheduled"
                                      ? "secondary"
                                      : "default"
                                  }
                                  className="mt-1"
                                >
                                  {activity.data.status}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Meta Info */}
              <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
                <p>
                  Creato: {format(new Date(contact.created_at), "d MMM yyyy HH:mm", { locale: it })}
                </p>
                {contact.last_activity_at && (
                  <p>
                    Ultima attività:{" "}
                    {format(new Date(contact.last_activity_at), "d MMM yyyy HH:mm", { locale: it })}
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Contatto non trovato
          </div>
        )}
      </SheetContent>

      {/* Appointment Dialog */}
      {contactId && contact && (
        <CreateAppointmentDialog
          open={showAppointmentDialog}
          onOpenChange={setShowAppointmentDialog}
          contactId={contactId}
          contactName={contact.name}
        />
      )}
    </Sheet>
  );
}
