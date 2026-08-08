import { useState } from "react";
import { ContactWithDetails, Stage } from "@/hooks/useCRM";
import { useCreateAppointment } from "@/hooks/useCreateAppointment";
import { useCallQueue } from "@/hooks/useCallQueue";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Phone,
  CalendarPlus,
  StickyNote,
  Loader2,
  User,
  Mail,
  PhoneOff,
  Play,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface LeadsToCallTabProps {
  contacts: ContactWithDetails[];
  stages: Stage[];
  onViewContact: (contact: ContactWithDetails) => void;
  onMoveContact: (contactId: string, stageId: string) => void;
  contactQueueMap: Map<string, { attempt_count: number; max_attempts: number; status: string; next_attempt_at: string | null }>;
}

const sourceLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  facebook_leadads: { label: "Facebook", variant: "default" },
  contact_form: { label: "Form", variant: "secondary" },
  manual: { label: "Manuale", variant: "outline" },
  import: { label: "Import", variant: "outline" },
};

export function LeadsToCallTab({
  contacts,
  stages,
  onViewContact,
  onMoveContact,
  contactQueueMap,
}: LeadsToCallTabProps) {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const { createAppointment } = useCreateAppointment();
  const { addToQueue, triggerCall } = useCallQueue();
  const isCreating = createAppointment.isPending;

  const [selectedContact, setSelectedContact] = useState<ContactWithDetails | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [appointmentData, setAppointmentData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    time: "10:00",
    duration: 30,
    title: "",
  });

  // Find "Lead da chiamare" stage
  const leadsStage = stages.find((s) => s.name === "Lead da chiamare");
  const appointmentsStage = stages.find((s) => s.name === "Appuntamenti");

  // Get leads in this stage, sorted by most recent
  const leads = leadsStage
    ? contacts
        .filter((c) => c.contact_stages?.[0]?.stage_id === leadsStage.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  // Handle adding a note
  const handleAddNote = async () => {
    if (!selectedContact || !tenantId || !noteText.trim()) return;

    setIsAddingNote(true);
    try {
      const { error } = await supabase.from("lead_notes").insert({
        tenant_id: tenantId,
        contact_id: selectedContact.id,
        note_text: noteText.trim(),
      });

      if (error) throw error;

      await supabase
        .from("contacts")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", selectedContact.id);

      toast.success("Nota aggiunta");
      setNoteDialogOpen(false);
      setNoteText("");
      setSelectedContact(null);
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Errore nell'aggiungere la nota");
    } finally {
      setIsAddingNote(false);
    }
  };

  // Handle adding to call queue
  const handleAddToQueue = async (contact: ContactWithDetails) => {
    await addToQueue.mutateAsync({ contactId: contact.id, priority: 1 });
  };

  // Handle creating appointment
  const handleCreateAppointment = async () => {
    if (!selectedContact || !tenantId) return;

    const startDate = new Date(`${appointmentData.date}T${appointmentData.time}:00`);

    createAppointment.mutate(
      {
        contactId: selectedContact.id,
        title: appointmentData.title || `Call con ${selectedContact.name}`,
        startAt: startDate,
        durationMinutes: appointmentData.duration,
      },
      {
        onSuccess: () => {
          if (appointmentsStage) {
            onMoveContact(selectedContact.id, appointmentsStage.id);
          }
          toast.success("Appuntamento creato");
          setAppointmentDialogOpen(false);
          setSelectedContact(null);
          setAppointmentData({
            date: format(new Date(), "yyyy-MM-dd"),
            time: "10:00",
            duration: 30,
            title: "",
          });
        },
      }
    );
  };

  const openAppointmentDialog = (contact: ContactWithDetails) => {
    setSelectedContact(contact);
    setAppointmentData({
      ...appointmentData,
      title: `Call con ${contact.name}`,
    });
    setAppointmentDialogOpen(true);
  };

  const openNoteDialog = (contact: ContactWithDetails) => {
    setSelectedContact(contact);
    setNoteText("");
    setNoteDialogOpen(true);
  };

  const getSourceBadge = (contact: ContactWithDetails) => {
    const source = contact.contact_sources?.[0]?.source;
    if (!source) return null;
    const config = sourceLabels[source] || { label: source, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getCallAttemptBadge = (contact: ContactWithDetails) => {
    const queueInfo = contactQueueMap.get(contact.id);
    if (!queueInfo) return null;

    const { attempt_count, max_attempts, status } = queueInfo;
    
    if (status === "completed" || status === "booked") {
      return (
        <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-200">
          ✓ Completato
        </Badge>
      );
    }
    
    if (attempt_count === 0) {
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
          In coda
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
        <PhoneOff className="h-3 w-3 mr-1" />
        {attempt_count}/{max_attempts} tentativi
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totale Lead
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leads.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Da Facebook
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leads.filter((l) => l.contact_sources?.[0]?.source === "facebook_leadads").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Coda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {leads.filter((l) => contactQueueMap.has(l.id)).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mai Risposto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {leads.filter((l) => {
                const q = contactQueueMap.get(l.id);
                return q && q.attempt_count > 0 && q.status !== "completed";
              }).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          {leads.length === 0 ? (
            <div className="py-12 text-center">
              <Phone className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Nessun lead da chiamare</p>
              <p className="text-sm text-muted-foreground mt-1">
                I nuovi lead appariranno qui automaticamente
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contatto</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Tentativi</TableHead>
                  <TableHead>Data Arrivo</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onViewContact(lead)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        {lead.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {lead.phone_e164 && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3" />
                            {lead.phone_e164}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {lead.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getSourceBadge(lead)}</TableCell>
                    <TableCell>{getCallAttemptBadge(lead)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(lead.created_at), "dd MMM yyyy, HH:mm", { locale: it })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {!contactQueueMap.has(lead.id) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddToQueue(lead)}
                            disabled={addToQueue.isPending}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Chiama
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAppointmentDialog(lead)}
                        >
                          <CalendarPlus className="w-4 h-4 mr-1" />
                          Appuntamento
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openNoteDialog(lead)}
                        >
                          <StickyNote className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi Nota per {selectedContact?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Scrivi una nota..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleAddNote} disabled={isAddingNote || !noteText.trim()}>
              {isAddingNote && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salva Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Dialog */}
      <Dialog open={appointmentDialogOpen} onOpenChange={setAppointmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fissa Appuntamento con {selectedContact?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titolo</Label>
              <Input
                value={appointmentData.title}
                onChange={(e) =>
                  setAppointmentData({ ...appointmentData, title: e.target.value })
                }
                placeholder="Call con..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={appointmentData.date}
                  onChange={(e) =>
                    setAppointmentData({ ...appointmentData, date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Ora</Label>
                <Input
                  type="time"
                  value={appointmentData.time}
                  onChange={(e) =>
                    setAppointmentData({ ...appointmentData, time: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Durata (minuti)</Label>
              <Input
                type="number"
                value={appointmentData.duration}
                onChange={(e) =>
                  setAppointmentData({
                    ...appointmentData,
                    duration: parseInt(e.target.value) || 30,
                  })
                }
                min={15}
                step={15}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppointmentDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreateAppointment} disabled={isCreating}>
              {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crea Appuntamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
