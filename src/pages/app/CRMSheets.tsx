import { useState, useMemo, useEffect } from "react";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Stage, StageType, STAGE_TYPES, STAGE_TYPE_LABELS } from "@/hooks/useCRM";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Pencil, Trash2, X, Check, Building2, FileText, Eye, ArrowRight, Calendar, Video, Settings2, GripVertical, Phone, MessageCircle, MapPin, Clock, Link2, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Types
interface Contact {
  id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string | null;
  do_not_contact: boolean | null;
  from_inactive_form: boolean | null;
  tenant_id: string;
  submission_id: string | null;
  stage: string;
  zoom_link: string | null;
  appointment_datetime: string | null;
  contact_sources: { source: string }[] | null;
  contact_stages: { stage_id: string }[] | null;
}

interface CallQueueItem {
  id: string;
  contact_id: string;
  status: string;
  last_voice_outcome: string | null;
  last_wa_outcome: string | null;
  next_attempt_at: string | null;
  attempt_count: number | null;
  outcome: string | null;
  notes: string | null;
  callback_source: string | null;
}

interface FormQuestion {
  id: string;
  question_key: string;
  question_label: string;
  question_order: number;
}

interface FormAnswer {
  id: string;
  question_key: string;
  question_label: string;
  answer_text: string | null;
  created_at: string;
}

interface FormSubmission {
  id: string;
  received_at: string;
  raw_payload: any;
}

type SortDirection = "asc" | "desc" | null;

// ── Helper: get contact's stage_id from contact_stages ──
function getContactStageId(contact: Contact): string | null {
  return contact.contact_stages?.[0]?.stage_id || null;
}

// ── Sheet Tab Component ──
function SheetTabs({
  activeStageId,
  onTabChange,
  stages,
  counts,
  onEditTabs,
}: {
  activeStageId: string;
  onTabChange: (stageId: string) => void;
  stages: Stage[];
  counts: Record<string, number>;
  onEditTabs: () => void;
}) {
  return (
    <div className="flex items-center border-t bg-muted/30">
      {stages.filter(s => s.is_active).map((stage) => (
        <button
          key={stage.id}
          onClick={() => onTabChange(stage.id)}
          className={cn(
            "px-4 py-2 text-sm font-medium border-r border-t-2 transition-colors relative",
            activeStageId === stage.id
              ? "bg-background border-t-primary text-foreground"
              : "bg-muted/50 border-t-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          style={activeStageId === stage.id ? { borderTopColor: stage.color } : undefined}
        >
          <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: stage.color }} />
          {stage.name}
          <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
            {counts[stage.id] || 0}
          </Badge>
        </button>
      ))}
      <button
        onClick={onEditTabs}
        className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 border-t-2 border-t-transparent transition-colors"
        title="Personalizza tab"
      >
        <Settings2 className="h-4 w-4" />
      </button>
      <div className="flex-1 bg-muted/50 border-t-2 border-t-transparent" />
    </div>
  );
}

// ── Tab Editor Dialog (edits stages table directly) ──
function TabEditorDialog({
  open,
  onClose,
  stages,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  stages: Stage[];
  onSave: (stages: Array<{ id?: string; name: string; stage_type: StageType; color: string; position: number; is_active: boolean }>) => void;
  isSaving: boolean;
}) {
  const [editStages, setEditStages] = useState(stages.map(s => ({ ...s })));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStageType, setNewStageType] = useState<StageType>("new_lead");
  const [newColor, setNewColor] = useState("#6366F1");

  useEffect(() => {
    setEditStages(stages.map(s => ({ ...s })));
  }, [stages, open]);

  const startEdit = (stage: Stage) => {
    setEditingId(stage.id);
    setEditLabel(stage.name);
  };

  const saveEdit = () => {
    if (!editingId || !editLabel.trim()) return;
    setEditStages(prev => prev.map(s => s.id === editingId ? { ...s, name: editLabel.trim() } : s));
    setEditingId(null);
  };

  const deleteStage = (id: string) => {
    if (editStages.length <= 1) return;
    setEditStages(prev => prev.filter(s => s.id !== id));
  };

  const addStage = () => {
    if (!newName.trim()) return;
    const tempId = `new_${Date.now()}`;
    setEditStages(prev => [...prev, {
      id: tempId,
      name: newName.trim(),
      stage_type: newStageType as StageType,
      color: newColor,
      position: prev.length,
      is_active: true,
      pipeline_id: stages[0]?.pipeline_id || "",
    }]);
    setNewName("");
    setNewStageType("new_lead");
    setNewColor("#6366F1");
    setShowAddForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Personalizza Fogli CRM
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 py-2">
          {editStages.map((stage) => (
            <div key={stage.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
              {editingId === stage.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="h-8"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                    <Check className="h-3 w-3 text-primary" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{stage.name}</span>
                  <Badge variant="outline" className="text-xs">{STAGE_TYPE_LABELS[stage.stage_type as StageType] || stage.stage_type}</Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(stage as Stage)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7 text-destructive" 
                    onClick={() => deleteStage(stage.id)}
                    disabled={editStages.length <= 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        {showAddForm ? (
          <div className="border rounded-lg p-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome foglio</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Es. Preventivi"
                className="h-8"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo logico (per automazioni AI)</Label>
              <Select value={newStageType} onValueChange={(v) => setNewStageType(v as StageType)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{STAGE_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Colore</Label>
              <div className="flex gap-2">
                {["#3B82F6", "#F59E0B", "#8B5CF6", "#10B981", "#EF4444", "#EC4899", "#6366F1", "#14B8A6"].map(c => (
                  <button
                    key={c}
                    className={cn("w-6 h-6 rounded-full border-2 transition-all", newColor === c ? "border-foreground scale-110" : "border-transparent")}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addStage} disabled={!newName.trim()}>Aggiungi</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Annulla</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full gap-2" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" />
            Aggiungi foglio
          </Button>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={() => onSave(editStages.map((s, i) => ({
            id: s.id.startsWith("new_") ? undefined : s.id,
            name: s.name,
            stage_type: s.stage_type as StageType,
            color: s.color,
            position: i,
            is_active: s.is_active,
          })))} disabled={isSaving}>
            {isSaving ? "Salvataggio..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sortable Header ──
function SortableHeader({
  label, sortKey, currentSort, onSort,
}: {
  label: string; sortKey: string;
  currentSort: { key: string; direction: SortDirection };
  onSort: (key: string) => void;
}) {
  const isActive = currentSort.key === sortKey;
  return (
    <button onClick={() => onSort(sortKey)} className="flex items-center gap-1 hover:text-foreground transition-colors text-left font-medium">
      {label}
      {isActive && currentSort.direction === "asc" && <ArrowUp className="h-3 w-3" />}
      {isActive && currentSort.direction === "desc" && <ArrowDown className="h-3 w-3" />}
      {!isActive && <ArrowUpDown className="h-3 w-3 opacity-30" />}
    </button>
  );
}

// ── Editable Cell ──
function EditableCell({
  value, onSave, type = "text", placeholder,
}: {
  value: string; onSave: (value: string) => void;
  type?: "text" | "email" | "tel" | "url" | "datetime-local"; placeholder?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => { onSave(editValue); setIsEditing(false); };
  const handleCancel = () => { setEditValue(value); setIsEditing(false); };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} type={type} className="h-7 text-sm px-2" autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }} />
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSave}><Check className="h-3 w-3 text-primary" /></Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancel}><X className="h-3 w-3 text-destructive" /></Button>
      </div>
    );
  }

  return (
    <div className="cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded -mx-1 group flex items-center gap-1" onClick={() => setIsEditing(true)}>
      <span className={cn(!value && "text-muted-foreground italic")}>{value || placeholder || "—"}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50" />
    </div>
  );
}

// ── Questions Block ──
function QuestionsBlock({ questions, formName, isLoading }: { questions: FormQuestion[]; formName: string | null; isLoading: boolean; }) {
  if (isLoading) return <div className="bg-muted/30 border-b p-4"><div className="text-sm text-muted-foreground">Caricamento domande...</div></div>;
  if (questions.length === 0) return (
    <div className="bg-muted/30 border-b p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="h-4 w-4" /><span>Nessun modulo Facebook attivo configurato. Vai in Impostazioni per selezionare un modulo.</span>
      </div>
    </div>
  );
  return (
    <div className="bg-primary/5 border-b p-4">
      <div className="flex items-center gap-2 mb-3"><FileText className="h-4 w-4 text-primary" /><span className="font-semibold text-sm">DOMANDE MODULO {formName ? `(${formName})` : ""}</span></div>
      <div className="flex flex-wrap gap-2">{questions.map((q, idx) => <Badge key={q.id} variant="outline" className="bg-background text-xs">{idx + 1}. {q.question_label}</Badge>)}</div>
    </div>
  );
}

// ── Answers Modal ──
function AnswersModal({ open, onClose, contactName, submissionId }: { open: boolean; onClose: () => void; contactName: string; submissionId: string | null; }) {
  const { data: submission, isLoading: submissionLoading } = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: async () => {
      if (!submissionId) return null;
      const { data, error } = await supabase.from("facebook_form_submissions").select("*").eq("id", submissionId).single();
      if (error) throw error;
      return data as FormSubmission;
    },
    enabled: !!submissionId && open,
  });

  const { data: answers = [], isLoading: answersLoading } = useQuery({
    queryKey: ["form-answers", submissionId],
    queryFn: async () => {
      if (!submissionId) return [];
      const { data, error } = await supabase.from("facebook_form_answers").select("*").eq("submission_id", submissionId).order("created_at", { ascending: true });
      if (error) throw error;
      return data as FormAnswer[];
    },
    enabled: !!submissionId && open,
  });

  const isLoading = submissionLoading || answersLoading;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Risposte modulo: {contactName}</DialogTitle></DialogHeader>
        {!submissionId ? (
          <div className="text-sm text-muted-foreground py-4">Questo contatto non ha una submission Facebook collegata.</div>
        ) : isLoading ? (
          <div className="text-sm text-muted-foreground py-4">Caricamento...</div>
        ) : (
          <div className="space-y-4">
            {submission && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Data arrivo lead</div>
                <div className="font-medium">{format(new Date(submission.received_at), "d MMMM yyyy 'alle' HH:mm", { locale: it })}</div>
              </div>
            )}
            {answers.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nessuna risposta registrata.</div>
            ) : (
              <div className="space-y-3">
                {answers.map((answer) => (
                  <div key={answer.id} className="border-b pb-3 last:border-b-0">
                    <div className="text-xs text-muted-foreground mb-1">{answer.question_label}</div>
                    <div className="font-medium text-sm">{answer.answer_text || "—"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════
export default function CRMSheets() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeStageId, setActiveStageId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({ key: "created_at", direction: "desc" });
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [showNewContactRow, setShowNewContactRow] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "" });
  const [answersModal, setAnswersModal] = useState<{ open: boolean; contact: Contact | null }>({ open: false, contact: null });
  const [showTabEditor, setShowTabEditor] = useState(false);

  // ── Fetch pipeline + stages ──
  const { data: pipelineData, isLoading: pipelineLoading } = useQuery({
    queryKey: ["crm-pipeline", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data: pipelines, error: pipelineError } = await supabase
        .from("pipelines").select("*").eq("tenant_id", tenantId).limit(1);
      if (pipelineError) throw pipelineError;

      let pipelineId: string;

      if (!pipelines || pipelines.length === 0) {
        const { data: newPipeline, error: createError } = await supabase
          .from("pipelines").insert({ tenant_id: tenantId, name: "Pipeline Principale" }).select().single();
        if (createError) throw createError;
        pipelineId = newPipeline.id;

        const defaultStages = [
          { name: "Contatti Facebook", position: 0, pipeline_id: pipelineId, tenant_id: tenantId, stage_type: "new_lead", color: "#3B82F6" },
          { name: "Da richiamare", position: 1, pipeline_id: pipelineId, tenant_id: tenantId, stage_type: "to_call", color: "#F59E0B" },
          { name: "Appuntamento fissato", position: 2, pipeline_id: pipelineId, tenant_id: tenantId, stage_type: "appointment_set", color: "#8B5CF6" },
          { name: "Contratti chiusi", position: 3, pipeline_id: pipelineId, tenant_id: tenantId, stage_type: "closed_won", color: "#10B981" },
        ];
        await supabase.from("stages").insert(defaultStages);
      } else {
        pipelineId = pipelines[0].id;
      }

      const { data: stages, error: stagesError } = await supabase
        .from("stages").select("*").eq("pipeline_id", pipelineId).order("position", { ascending: true });
      if (stagesError) throw stagesError;

      return { pipelineId, stages: (stages || []) as Stage[] };
    },
    enabled: !!tenantId,
  });

  const stages = pipelineData?.stages || [];
  const activeStages = stages.filter(s => s.is_active);

  // Set initial active tab
  useEffect(() => {
    if (activeStages.length > 0 && !activeStageId) {
      setActiveStageId(activeStages[0].id);
    }
  }, [activeStages, activeStageId]);

  // ── Fetch settings (for facebook form) ──
  const { data: settings } = useQuery({
    queryKey: ["settings", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase.from("settings").select("active_facebook_form_id").eq("tenant_id", tenantId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // ── Fetch active form info ──
  const { data: activeForm } = useQuery({
    queryKey: ["active-form", settings?.active_facebook_form_id],
    queryFn: async () => {
      if (!settings?.active_facebook_form_id) return null;
      const { data, error } = await supabase.from("facebook_forms").select("id, form_name, external_form_id").eq("id", settings.active_facebook_form_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!settings?.active_facebook_form_id,
  });

  // ── Fetch form questions ──
  const { data: formQuestions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ["form-questions", settings?.active_facebook_form_id],
    queryFn: async () => {
      if (!settings?.active_facebook_form_id) return [];
      const { data, error } = await supabase.from("facebook_form_questions").select("*").eq("form_id", settings.active_facebook_form_id).order("question_order", { ascending: true });
      if (error) throw error;
      return data as FormQuestion[];
    },
    enabled: !!settings?.active_facebook_form_id,
  });

  // ── Fetch contacts with contact_stages ──
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["crm-sheets-contacts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select(`*, contact_sources(*), contact_stages(stage_id)`)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Contact[];
    },
    enabled: !!tenantId,
  });

  // ── Fetch call_queue data for "to_call" tab ──
  const { data: callQueueItems = [] } = useQuery({
    queryKey: ["crm-call-queue", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("call_queue")
        .select("id, contact_id, status, last_voice_outcome, last_wa_outcome, next_attempt_at, attempt_count, outcome, notes, callback_source")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return (data || []) as CallQueueItem[];
    },
    enabled: !!tenantId,
  });

  // Build call_queue lookup by contact_id
  const callQueueByContact = useMemo(() => {
    const map: Record<string, CallQueueItem> = {};
    for (const item of callQueueItems) {
      map[item.contact_id] = item;
    }
    return map;
  }, [callQueueItems]);

  // ── Fetch lead_notes for "to_call" tab ──
  const { data: leadNotes = [] } = useQuery({
    queryKey: ["crm-lead-notes", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("lead_notes")
        .select("contact_id, note_text, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Last note per contact
  const lastNoteByContact = useMemo(() => {
    const map: Record<string, string> = {};
    for (const note of leadNotes) {
      if (!map[note.contact_id]) {
        map[note.contact_id] = note.note_text;
      }
    }
    return map;
  }, [leadNotes]);

  // ── Fetch appointments for "appointment_set" tab ──
  const { data: appointmentsList = [] } = useQuery({
    queryKey: ["crm-sheets-appointments", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("id, contact_id, title, meeting_type, meeting_provider, meet_link, location, start_at, end_at, status, description, updated_at")
        .eq("tenant_id", tenantId)
        .order("start_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Appointments by contact_id (latest per contact)
  const appointmentByContact = useMemo(() => {
    const map: Record<string, typeof appointmentsList[0]> = {};
    for (const appt of appointmentsList) {
      if (appt.contact_id) {
        // Keep the most recent (last in sorted list)
        map[appt.contact_id] = appt;
      }
    }
    return map;
  }, [appointmentsList]);

  // ── Save stages mutation (tab editor) ──
  const saveStagesMutation = useMutation({
    mutationFn: async (updatedStages: Array<{ id?: string; name: string; stage_type: StageType; color: string; position: number; is_active: boolean }>) => {
      if (!tenantId || !pipelineData) throw new Error("No tenant/pipeline");
      const pipelineId = pipelineData.pipelineId;

      // Delete removed stages
      const existingIds = stages.map(s => s.id);
      const keptIds = updatedStages.filter(s => s.id).map(s => s.id!);
      const deletedIds = existingIds.filter(id => !keptIds.includes(id));

      for (const id of deletedIds) {
        // Move contacts from deleted stage to first remaining stage
        const firstKeptId = keptIds[0];
        if (firstKeptId) {
          await supabase.from("contact_stages").update({ stage_id: firstKeptId }).eq("stage_id", id);
        }
        await supabase.from("stages").delete().eq("id", id);
      }

      // Upsert stages
      for (const stage of updatedStages) {
        if (stage.id) {
          await supabase.from("stages").update({
            name: stage.name,
            stage_type: stage.stage_type,
            color: stage.color,
            position: stage.position,
            is_active: stage.is_active,
          }).eq("id", stage.id);
        } else {
          await supabase.from("stages").insert({
            tenant_id: tenantId,
            pipeline_id: pipelineId,
            name: stage.name,
            stage_type: stage.stage_type,
            color: stage.color,
            position: stage.position,
            is_active: stage.is_active,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["crm-sheets-contacts"] });
      toast({ title: "Pipeline aggiornata" });
      setShowTabEditor(false);
    },
    onError: (error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // ── Create contact mutation ──
  const createContactMutation = useMutation({
    mutationFn: async (data: { name: string; phone?: string; email?: string }) => {
      if (!tenantId) throw new Error("No tenant");
      const currentStageId = activeStageId;
      const { data: contact, error } = await supabase
        .from("contacts")
        .insert({ tenant_id: tenantId, name: data.name, phone_e164: data.phone || null, email: data.email || null })
        .select()
        .single();
      if (error) throw error;

      // Link to current stage via contact_stages
      if (currentStageId) {
        await supabase.from("contact_stages").insert({ tenant_id: tenantId, contact_id: contact.id, stage_id: currentStageId });
      }

      await supabase.from("contact_sources").insert({ tenant_id: tenantId, contact_id: contact.id, source: "manual" });
      return contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-sheets-contacts"] });
      toast({ title: "Contatto creato" });
      setShowNewContactRow(false);
      setNewContact({ name: "", phone: "", email: "" });
    },
    onError: (error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // ── Update contact mutation ──
  const updateContactMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Contact> }) => {
      const { error } = await supabase.from("contacts").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-sheets-contacts"] });
      toast({ title: "Contatto aggiornato" });
    },
    onError: (error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // ── Move contact to stage (via contact_stages) ──
  const moveContactMutation = useMutation({
    mutationFn: async ({ contactId, stageId, createAppointment }: { contactId: string; stageId: string; createAppointment?: { datetime: string; zoomLink?: string; contactName: string } }) => {
      if (!tenantId) throw new Error("No tenant");

      // Upsert contact_stages
      const { data: existing } = await supabase.from("contact_stages").select("id").eq("contact_id", contactId).single();
      if (existing) {
        await supabase.from("contact_stages").update({ stage_id: stageId, updated_at: new Date().toISOString() }).eq("contact_id", contactId);
      } else {
        await supabase.from("contact_stages").insert({ tenant_id: tenantId, contact_id: contactId, stage_id: stageId });
      }

      // Update last_activity
      await supabase.from("contacts").update({ last_activity_at: new Date().toISOString() }).eq("id", contactId);

      // Auto-create appointment if moving to appointment_set stage
      const targetStage = stages.find(s => s.id === stageId);
      if (targetStage?.stage_type === "appointment_set" && createAppointment) {
        const startAt = new Date(createAppointment.datetime);
        const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
        await supabase.from("appointments").insert({
          tenant_id: tenantId,
          contact_id: contactId,
          title: `Appuntamento: ${createAppointment.contactName}`,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          meeting_type: createAppointment.zoomLink ? "zoom" : "in_person",
          meet_link: createAppointment.zoomLink || null,
          status: "scheduled",
          created_from: "crm",
        });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["crm-sheets-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["crm-sheets-appointments"] });
      const targetStage = stages.find(s => s.id === variables.stageId);
      toast({ title: `Contatto spostato in "${targetStage?.name || "?"}"` });
    },
    onError: (error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // ── Delete contact mutation ──
  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-sheets-contacts"] });
      toast({ title: "Contatto eliminato" });
      setDeleteContactId(null);
    },
    onError: (error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // ── Auto-move when zoom_link or appointment_datetime is set ──
  const handleAutoMove = async (contactId: string, field: "zoom_link" | "appointment_datetime", value: string, contact: Contact) => {
    await updateContactMutation.mutateAsync({ id: contactId, updates: { [field]: value || null } as any });

    // If contact is in new_lead stage and value is set, move to appointment_set
    const contactStageId = getContactStageId(contact);
    const currentStage = stages.find(s => s.id === contactStageId);
    if (currentStage?.stage_type === "new_lead" && value) {
      const appointmentStage = stages.find(s => s.stage_type === "appointment_set" && s.is_active);
      if (appointmentStage) {
        const currentContact = contacts.find(c => c.id === contactId);
        const zoomLink = field === "zoom_link" ? value : currentContact?.zoom_link;
        const datetime = field === "appointment_datetime" ? value : currentContact?.appointment_datetime;

        if (zoomLink || datetime) {
          await moveContactMutation.mutateAsync({
            contactId,
            stageId: appointmentStage.id,
            createAppointment: datetime ? { datetime, zoomLink: zoomLink || undefined, contactName: contact.name } : undefined,
          });
        }
      }
    }
  };

  // ── Derived data ──
  const currentStage = stages.find(s => s.id === activeStageId);
  const isNewLeadTab = currentStage?.stage_type === "new_lead";
  const isToCallTab = currentStage?.stage_type === "to_call";
  const isAppointmentTab = currentStage?.stage_type === "appointment_set";
  const isClosedTab = currentStage?.stage_type === "closed_won";

  // Count contacts per stage
  const counts: Record<string, number> = useMemo(() => {
    const result: Record<string, number> = {};
    for (const stage of activeStages) {
      result[stage.id] = contacts.filter(c => getContactStageId(c) === stage.id).length;
    }
    // Count contacts without a stage assignment
    const unassigned = contacts.filter(c => !getContactStageId(c));
    if (activeStages.length > 0 && unassigned.length > 0) {
      result[activeStages[0].id] = (result[activeStages[0].id] || 0) + unassigned.length;
    }
    return result;
  }, [contacts, activeStages]);

  // Filter contacts for current tab
  const currentData = useMemo(() => {
    let data = contacts.filter(c => {
      const stageId = getContactStageId(c);
      if (stageId === activeStageId) return true;
      // Unassigned contacts go to first stage
      if (!stageId && activeStages.length > 0 && activeStageId === activeStages[0].id) return true;
      return false;
    });

    if (search) {
      const lowerSearch = search.toLowerCase();
      data = data.filter((item) =>
        item.name?.toLowerCase().includes(lowerSearch) ||
        item.phone_e164?.includes(lowerSearch) ||
        item.email?.toLowerCase().includes(lowerSearch)
      );
    }

    if (sort.key && sort.direction) {
      data = [...data].sort((a, b) => {
        const aVal = (a as any)[sort.key];
        const bVal = (b as any)[sort.key];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (typeof aVal === "string") {
          const cmp = aVal.localeCompare(bVal);
          return sort.direction === "asc" ? cmp : -cmp;
        }
        return sort.direction === "asc" ? aVal - bVal : bVal - aVal;
      });
    }
    return data;
  }, [contacts, activeStageId, activeStages, search, sort]);

  const handleSort = (key: string) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key ? (prev.direction === "asc" ? "desc" : prev.direction === "desc" ? null : "asc") : "asc",
    }));
  };

  const handleCreateContact = () => {
    if (!newContact.name.trim()) { toast({ title: "Inserisci un nome", variant: "destructive" }); return; }
    createContactMutation.mutate(newContact);
  };

  const getMoveOptions = (contactStageId: string | null) => {
    return activeStages
      .filter(s => s.id !== contactStageId)
      .map(s => ({ label: s.name, stageId: s.id, color: s.color }));
  };

  const isLoading = contactsLoading || pipelineLoading;

  return (
    <FeatureGate feature="crm_basic_enabled" title="CRM Contatti" description="Gestisci i tuoi contatti con storico interazioni, pipeline personalizzabile, note e filtri avanzati.">
      <div className="h-full flex flex-col bg-background">
        {/* Top Bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">CRM</span>
          </div>
          <div className="flex-1 flex items-center gap-3 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cerca contatti..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>
          <Button onClick={() => setShowNewContactRow(true)} className="gap-2">
            <Plus className="h-4 w-4" />Nuovo
          </Button>
        </div>

         {/* Questions Block (only for new_lead and to_call stage type — NOT appointment) */}
         {(isNewLeadTab || isToCallTab) && (
          <QuestionsBlock questions={formQuestions} formName={activeForm?.form_name || null} isLoading={questionsLoading} />
        )}

        {/* Sheet Content */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[900px]">
            {/* Table Header */}
            <div className="sticky top-0 z-10 bg-muted/50 border-b">
              {isAppointmentTab ? (
                <div className="grid grid-cols-[1fr_120px_100px_90px_60px_70px_150px_90px_90px_1fr_80px_60px] gap-2 px-4 py-2 text-sm text-muted-foreground">
                  <SortableHeader label="Nome" sortKey="name" currentSort={sort} onSort={handleSort} />
                  <span>Telefono</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Tipo</span>
                  <span>Data</span>
                  <span>Ora</span>
                  <span>Durata</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Indirizzo / Link</span>
                  <span>Provider</span>
                  <span>Stato</span>
                  <span>Note</span>
                  <span>Aggiornato</span>
                  <span>Azioni</span>
                </div>
              ) : isToCallTab ? (
                <div className="grid grid-cols-[1fr_130px_100px_100px_100px_120px_1fr_60px] gap-2 px-4 py-2 text-sm text-muted-foreground">
                  <SortableHeader label="Nome" sortKey="name" currentSort={sort} onSort={handleSort} />
                  <SortableHeader label="Telefono" sortKey="phone_e164" currentSort={sort} onSort={handleSort} />
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Ultima call</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> Ultimo WA</span>
                  <span>Sorgente</span>
                  <span>Prossimo richiamo</span>
                  <span>Note / Esito</span>
                  <span>Azioni</span>
                </div>
              ) : isNewLeadTab ? (
                <div className="grid grid-cols-[1fr_130px_180px_100px_100px_100px_60px] gap-2 px-4 py-2 text-sm text-muted-foreground">
                  <SortableHeader label="Nome" sortKey="name" currentSort={sort} onSort={handleSort} />
                  <SortableHeader label="Telefono" sortKey="phone_e164" currentSort={sort} onSort={handleSort} />
                  <SortableHeader label="Email" sortKey="email" currentSort={sort} onSort={handleSort} />
                  <span>Modulo</span>
                  <SortableHeader label="Data ingresso" sortKey="created_at" currentSort={sort} onSort={handleSort} />
                  <span>Stato</span>
                  <span>Azioni</span>
                </div>
              ) : isClosedTab ? (
                <div className="grid grid-cols-[1fr_130px_180px_120px_1fr_60px] gap-2 px-4 py-2 text-sm text-muted-foreground">
                  <SortableHeader label="Nome" sortKey="name" currentSort={sort} onSort={handleSort} />
                  <SortableHeader label="Telefono" sortKey="phone_e164" currentSort={sort} onSort={handleSort} />
                  <SortableHeader label="Email" sortKey="email" currentSort={sort} onSort={handleSort} />
                  <SortableHeader label="Data chiusura" sortKey="last_activity_at" currentSort={sort} onSort={handleSort} />
                  <span>Note</span>
                  <span>Azioni</span>
                </div>
              ) : (
                /* Generic / custom stage */
                <div className="grid grid-cols-[1fr_130px_180px_120px_60px] gap-2 px-4 py-2 text-sm text-muted-foreground">
                  <SortableHeader label="Nome" sortKey="name" currentSort={sort} onSort={handleSort} />
                  <SortableHeader label="Telefono" sortKey="phone_e164" currentSort={sort} onSort={handleSort} />
                  <SortableHeader label="Email" sortKey="email" currentSort={sort} onSort={handleSort} />
                  <SortableHeader label="Creato" sortKey="created_at" currentSort={sort} onSort={handleSort} />
                  <span>Azioni</span>
                </div>
              )}
            </div>

            {/* New Contact Row */}
            {showNewContactRow && (
              <div className={cn(
                "gap-2 px-4 py-2 border-b bg-primary/5 grid",
                isAppointmentTab ? "grid-cols-[1fr_120px_100px_90px_60px_70px_150px_90px_90px_1fr_80px_60px]" :
                isToCallTab ? "grid-cols-[1fr_130px_100px_100px_100px_120px_1fr_60px]" :
                isNewLeadTab ? "grid-cols-[1fr_130px_180px_100px_100px_100px_60px]" :
                isClosedTab ? "grid-cols-[1fr_130px_180px_120px_1fr_60px]" :
                "grid-cols-[1fr_130px_180px_120px_60px]"
              )}>
                <Input placeholder="Nome *" value={newContact.name} onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))} className="h-8" autoFocus />
                <Input placeholder="+39..." value={newContact.phone} onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))} className="h-8" />
                {isAppointmentTab ? (
                  <><span /><span /><span /><span /><span /><span /><span /><span /></>
                ) : isToCallTab ? (
                  <><span /><span /><span /><span /><span /></>
                ) : isNewLeadTab ? (
                  <>
                    <Input placeholder="email@..." value={newContact.email} onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))} className="h-8" />
                    <span /><span /><span />
                  </>
                ) : isClosedTab ? (
                  <>
                    <Input placeholder="email@..." value={newContact.email} onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))} className="h-8" />
                    <span /><span />
                  </>
                ) : (
                  <>
                    <Input placeholder="email@..." value={newContact.email} onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))} className="h-8" />
                    <span />
                  </>
                )}
                <div className="flex gap-1">
                  <Button size="sm" variant="default" onClick={handleCreateContact} disabled={createContactMutation.isPending}><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewContactRow(false)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            )}

            {/* Table Rows */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">Caricamento...</div>
            ) : currentData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <p>Nessun contatto in questo foglio</p>
                <Button variant="link" onClick={() => setShowNewContactRow(true)}>Aggiungi un contatto</Button>
              </div>
            ) : isAppointmentTab ? (
              /* ── APPOINTMENT specific rows ── */
              currentData.map((contact) => {
                const contactStageId = getContactStageId(contact);
                const appt = appointmentByContact[contact.id];

                const meetingTypeLabel = (t: string | null) => {
                  if (!t) return "—";
                  const map: Record<string, string> = { in_person: "Sopralluogo", online: "Online", zoom: "Zoom", google_meet: "Google Meet", call: "Call" };
                  return map[t] || t;
                };
                const providerLabel = (p: string | null) => {
                  if (!p) return "—";
                  const map: Record<string, string> = { google_meet: "Google Meet", zoom: "Zoom", none: "—" };
                  return map[p] || p;
                };
                const statusLabel = (s: string | null) => {
                  if (!s) return "—";
                  const map: Record<string, string> = { scheduled: "Fissato", confirmed: "Confermato", cancelled: "Annullato", canceled: "Annullato", completed: "Completato", no_show: "No show", rescheduled: "Spostato" };
                  return map[s] || s;
                };
                const statusColor = (s: string | null) => {
                  if (s === "confirmed" || s === "completed") return "text-green-600";
                  if (s === "cancelled" || s === "canceled" || s === "no_show") return "text-destructive";
                  if (s === "rescheduled") return "text-amber-600";
                  return "text-muted-foreground";
                };

                const durationMin = appt ? Math.round((new Date(appt.end_at).getTime() - new Date(appt.start_at).getTime()) / 60000) : null;
                const isOnline = appt?.meeting_type === "online" || appt?.meeting_type === "zoom" || appt?.meeting_type === "google_meet";

                return (
                  <div key={contact.id} className="grid grid-cols-[1fr_120px_100px_90px_60px_70px_150px_90px_90px_1fr_80px_60px] gap-2 px-4 py-2 border-b hover:bg-muted/30 transition-colors items-center text-sm">
                    {/* Nome */}
                    <EditableCell value={contact.name} onSave={(value) => updateContactMutation.mutate({ id: contact.id, updates: { name: value } })} />
                    {/* Telefono */}
                    <span className="text-xs truncate">{contact.phone_e164 || "—"}</span>
                    {/* Tipo */}
                    <Badge variant="outline" className="text-xs w-fit">
                      {meetingTypeLabel(appt?.meeting_type || null)}
                    </Badge>
                    {/* Data */}
                    <span className="text-xs">{appt ? format(new Date(appt.start_at), "d MMM yy", { locale: it }) : "—"}</span>
                    {/* Ora */}
                    <span className="text-xs">{appt ? format(new Date(appt.start_at), "HH:mm") : "—"}</span>
                    {/* Durata */}
                    <span className="text-xs text-muted-foreground">{durationMin ? `${durationMin} min` : "—"}</span>
                    {/* Indirizzo / Link */}
                    <div className="truncate text-xs">
                      {isOnline && appt?.meet_link ? (
                        <a href={appt.meet_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{appt.meeting_provider === "zoom" ? "Zoom" : "Meet"}</span>
                        </a>
                      ) : !isOnline && appt?.location ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                          <span className="truncate">{appt.location}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    {/* Provider */}
                    <span className="text-xs text-muted-foreground">{providerLabel(appt?.meeting_provider || null)}</span>
                    {/* Stato */}
                    <span className={cn("text-xs font-medium", statusColor(appt?.status || null))}>
                      {statusLabel(appt?.status || null)}
                    </span>
                    {/* Note */}
                    <div className="truncate text-xs text-muted-foreground" title={appt?.description || ""}>
                      {appt?.description || "—"}
                    </div>
                    {/* Aggiornato */}
                    <span className="text-xs text-muted-foreground">
                      {appt?.updated_at ? format(new Date(appt.updated_at), "d MMM", { locale: it }) : "—"}
                    </span>
                    {/* Azioni */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover w-48">
                        {getMoveOptions(contactStageId).map((option) => (
                          <DropdownMenuItem key={option.stageId} onClick={() => moveContactMutation.mutate({ contactId: contact.id, stageId: option.stageId })}>
                            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: option.color }} />
                            Sposta in {option.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteContactId(contact.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })
            ) : isToCallTab ? (
              /* ── TO_CALL specific rows ── */
              currentData.map((contact) => {
                const contactStageId = getContactStageId(contact);
                const cq = callQueueByContact[contact.id];
                const source = contact.contact_sources?.[0]?.source || "—";
                const lastNote = lastNoteByContact[contact.id];

                const voiceOutcomeLabel = (o: string | null) => {
                  if (!o) return "—";
                  const map: Record<string, string> = { no_answer: "Non risponde", busy: "Occupato", completed: "Completata", failed: "Fallita", appointment_booked: "Appuntamento" };
                  return map[o] || o;
                };
                const waOutcomeLabel = (o: string | null) => {
                  if (!o) return "—";
                  const map: Record<string, string> = { sent: "Inviato", delivered: "Consegnato", read: "Letto", failed: "Fallito", stop: "STOP" };
                  return map[o] || o;
                };

                return (
                  <div key={contact.id} className="grid grid-cols-[1fr_130px_100px_100px_100px_120px_1fr_60px] gap-2 px-4 py-2 border-b hover:bg-muted/30 transition-colors items-center text-sm">
                    <div className="flex items-center gap-2">
                      <EditableCell value={contact.name} onSave={(value) => updateContactMutation.mutate({ id: contact.id, updates: { name: value } })} />
                      {contact.submission_id && (
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setAnswersModal({ open: true, contact })} title="Risposte modulo">
                          <Eye className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <EditableCell value={contact.phone_e164 || ""} onSave={(value) => updateContactMutation.mutate({ id: contact.id, updates: { phone_e164: value || null } })} type="tel" />
                    {/* Ultima chiamata */}
                    <span className={cn("text-xs", cq?.last_voice_outcome === "completed" || cq?.last_voice_outcome === "appointment_booked" ? "text-green-600" : "text-muted-foreground")}>
                      {voiceOutcomeLabel(cq?.last_voice_outcome || null)}
                    </span>
                    {/* Ultimo WA */}
                    <span className={cn("text-xs", cq?.last_wa_outcome === "read" || cq?.last_wa_outcome === "delivered" ? "text-green-600" : "text-muted-foreground")}>
                      {waOutcomeLabel(cq?.last_wa_outcome || null)}
                    </span>
                    {/* Sorgente */}
                    <Badge variant="outline" className="text-xs w-fit">{source === "facebook_leadads" ? "Facebook" : source === "manual" ? "Manuale" : source === "contact_form" ? "Form" : source}</Badge>
                    {/* Prossimo richiamo */}
                    <span className="text-xs text-muted-foreground">
                      {cq?.next_attempt_at ? format(new Date(cq.next_attempt_at), "d MMM HH:mm", { locale: it }) : "—"}
                    </span>
                    {/* Note / Esito */}
                    <div className="truncate text-xs text-muted-foreground" title={lastNote || cq?.outcome || cq?.notes || ""}>
                      {lastNote || cq?.outcome || cq?.notes || "—"}
                    </div>
                    {/* Azioni */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover w-48">
                        {getMoveOptions(contactStageId).map((option) => (
                          <DropdownMenuItem key={option.stageId} onClick={() => moveContactMutation.mutate({ contactId: contact.id, stageId: option.stageId })}>
                            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: option.color }} />
                            Sposta in {option.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteContactId(contact.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })
            ) : isNewLeadTab ? (
              /* ── NEW_LEAD rows ── */
              currentData.map((contact) => {
                const contactStageId = getContactStageId(contact);
                const source = contact.contact_sources?.[0]?.source || "—";
                return (
                  <div key={contact.id} className="grid grid-cols-[1fr_130px_180px_100px_100px_100px_60px] gap-2 px-4 py-2 border-b hover:bg-muted/30 transition-colors items-center text-sm">
                    <div className="flex items-center gap-2">
                      <EditableCell value={contact.name} onSave={(value) => updateContactMutation.mutate({ id: contact.id, updates: { name: value } })} />
                      {contact.submission_id && (
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setAnswersModal({ open: true, contact })} title="Risposte modulo">
                          <Eye className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <EditableCell value={contact.phone_e164 || ""} onSave={(value) => updateContactMutation.mutate({ id: contact.id, updates: { phone_e164: value || null } })} type="tel" />
                    <EditableCell value={contact.email || ""} onSave={(value) => updateContactMutation.mutate({ id: contact.id, updates: { email: value || null } })} type="email" />
                    {/* Modulo */}
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs w-fit">{source === "facebook_leadads" ? "Facebook" : source === "manual" ? "Manuale" : source === "contact_form" ? "Form" : source}</Badge>
                      {contact.from_inactive_form && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">!</Badge>
                      )}
                    </div>
                    {/* Data ingresso */}
                    <span className="text-xs text-muted-foreground">{format(new Date(contact.created_at), "d MMM yy", { locale: it })}</span>
                    {/* Stato */}
                    <Badge variant="secondary" className="text-xs w-fit">Nuovo</Badge>
                    {/* Azioni */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover w-48">
                        {getMoveOptions(contactStageId).map((option) => (
                          <DropdownMenuItem key={option.stageId} onClick={() => moveContactMutation.mutate({ contactId: contact.id, stageId: option.stageId })}>
                            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: option.color }} />
                            Sposta in {option.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteContactId(contact.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })
            ) : isClosedTab ? (
              /* ── CLOSED_WON rows ── */
              currentData.map((contact) => {
                const contactStageId = getContactStageId(contact);
                const lastNote = lastNoteByContact[contact.id];
                return (
                  <div key={contact.id} className="grid grid-cols-[1fr_130px_180px_120px_1fr_60px] gap-2 px-4 py-2 border-b hover:bg-muted/30 transition-colors items-center text-sm">
                    <EditableCell value={contact.name} onSave={(value) => updateContactMutation.mutate({ id: contact.id, updates: { name: value } })} />
                    <span className="text-xs truncate">{contact.phone_e164 || "—"}</span>
                    <span className="text-xs truncate">{contact.email || "—"}</span>
                    {/* Data chiusura */}
                    <span className="text-xs text-muted-foreground">
                      {contact.last_activity_at ? format(new Date(contact.last_activity_at), "d MMM yy", { locale: it }) : format(new Date(contact.updated_at), "d MMM yy", { locale: it })}
                    </span>
                    {/* Note */}
                    <div className="truncate text-xs text-muted-foreground" title={lastNote || ""}>
                      {lastNote || "—"}
                    </div>
                    {/* Azioni */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover w-48">
                        {getMoveOptions(contactStageId).map((option) => (
                          <DropdownMenuItem key={option.stageId} onClick={() => moveContactMutation.mutate({ contactId: contact.id, stageId: option.stageId })}>
                            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: option.color }} />
                            Sposta in {option.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteContactId(contact.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })
            ) : (
              /* ── Generic / custom stage rows ── */
              currentData.map((contact) => {
                const contactStageId = getContactStageId(contact);
                return (
                  <div key={contact.id} className="grid grid-cols-[1fr_130px_180px_120px_60px] gap-2 px-4 py-2 border-b hover:bg-muted/30 transition-colors items-center text-sm">
                    <EditableCell value={contact.name} onSave={(value) => updateContactMutation.mutate({ id: contact.id, updates: { name: value } })} />
                    <EditableCell value={contact.phone_e164 || ""} onSave={(value) => updateContactMutation.mutate({ id: contact.id, updates: { phone_e164: value || null } })} type="tel" />
                    <EditableCell value={contact.email || ""} onSave={(value) => updateContactMutation.mutate({ id: contact.id, updates: { email: value || null } })} type="email" />
                    <span className="text-muted-foreground text-xs">{format(new Date(contact.created_at), "d MMM yy", { locale: it })}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover w-48">
                        {getMoveOptions(contactStageId).map((option) => (
                          <DropdownMenuItem key={option.stageId} onClick={() => moveContactMutation.mutate({ contactId: contact.id, stageId: option.stageId })}>
                            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: option.color }} />
                            Sposta in {option.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteContactId(contact.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom Tabs */}
        <SheetTabs
          activeStageId={activeStageId}
          onTabChange={setActiveStageId}
          stages={stages}
          counts={counts}
          onEditTabs={() => setShowTabEditor(true)}
        />

        {/* Tab Editor Dialog */}
        <TabEditorDialog
          open={showTabEditor}
          onClose={() => setShowTabEditor(false)}
          stages={stages}
          onSave={(s) => saveStagesMutation.mutate(s)}
          isSaving={saveStagesMutation.isPending}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteContactId} onOpenChange={() => setDeleteContactId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare questo contatto?</AlertDialogTitle>
              <AlertDialogDescription>Questa azione non può essere annullata.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteContactId && deleteContactMutation.mutate(deleteContactId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Elimina</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Answers Modal */}
        <AnswersModal open={answersModal.open} onClose={() => setAnswersModal({ open: false, contact: null })} contactName={answersModal.contact?.name || ""} submissionId={answersModal.contact?.submission_id || null} />
      </div>
    </FeatureGate>
  );
}
