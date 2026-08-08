import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  UserRoundCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface HandoffMetadata {
  handoff_owner: string;
  handoff_priority: "high" | "normal" | "low";
  handoff_due_at: string;
  handoff_reason: string;
  handoff_resolution: string;
}

interface HandoffLead {
  id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
  status: string;
  notes: string | null;
  form_payload: Json | null;
  last_contact_at: string | null;
  next_action_at: string | null;
  created_at: string;
}

interface HandoffInteraction {
  id: string;
  lead_id: string;
  channel: string;
  direction: string;
  content: string | null;
  outcome: string | null;
  created_at: string;
}

interface ResolvedHandoff {
  eventId: string;
  leadId: string;
  leadName: string;
  owner: string;
  resolution: string;
  resolvedAt: string;
}

function jsonObject(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
}

function textValue(value: Json | undefined): string {
  return typeof value === "string" ? value : "";
}

function priorityValue(value: Json | undefined): HandoffMetadata["handoff_priority"] {
  return value === "high" || value === "low" ? value : "normal";
}

function metadataFor(lead: HandoffLead, fallbackOwner: string): HandoffMetadata {
  const payload = jsonObject(lead.form_payload);
  return {
    handoff_owner: textValue(payload.handoff_owner) || fallbackOwner,
    handoff_priority: priorityValue(payload.handoff_priority),
    handoff_due_at: textValue(payload.handoff_due_at),
    handoff_reason: textValue(payload.handoff_reason) || lead.notes || "",
    handoff_resolution: "",
  };
}

function elapsedLabel(value: string | null, fallback: string): string {
  const timestamp = Date.parse(value || fallback);
  if (!Number.isFinite(timestamp)) return "Tempo non disponibile";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} giorni`;
}

function payloadRecord(value: Json | null): Record<string, Json | undefined> {
  return jsonObject(value);
}

export default function Handoffs() {
  const { membership, user } = useAuth();
  const tenantId = membership?.tenant_id;
  const fallbackOwner = user?.email || "Responsabile da assegnare";
  const [leads, setLeads] = useState<HandoffLead[]>([]);
  const [interactions, setInteractions] = useState<HandoffInteraction[]>([]);
  const [resolved, setResolved] = useState<ResolvedHandoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, HandoffMetadata>>({});

  const load = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [leadResult, auditResult] = await Promise.all([
        supabase
          .from("leads")
          .select("id,name,phone_e164,email,status,notes,form_payload,last_contact_at,next_action_at,created_at")
          .eq("tenant_id", tenantId)
          .eq("handoff_status", "HUMAN")
          .order("last_contact_at", { ascending: false }),
        supabase
          .from("audit_log")
          .select("id,action,payload_json,created_at")
          .eq("tenant_id", tenantId)
          .in("action", ["handoff.resolved", "handoff.reopened"])
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (leadResult.error) throw leadResult.error;
      if (auditResult.error) throw auditResult.error;

      const normalized = (leadResult.data ?? []) as HandoffLead[];
      setLeads(normalized);
      setDrafts(Object.fromEntries(normalized.map((lead) => [lead.id, metadataFor(lead, fallbackOwner)])));

      const leadIds = normalized.map((lead) => lead.id);
      if (leadIds.length > 0) {
        const { data: interactionData, error: interactionError } = await supabase
          .from("interactions")
          .select("id,lead_id,channel,direction,content,outcome,created_at")
          .eq("tenant_id", tenantId)
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false });
        if (interactionError) throw interactionError;
        setInteractions((interactionData ?? []) as HandoffInteraction[]);
      } else {
        setInteractions([]);
      }

      const reopened = new Set<string>();
      const history: ResolvedHandoff[] = [];
      for (const event of auditResult.data ?? []) {
        const payload = payloadRecord(event.payload_json);
        const leadId = textValue(payload.lead_id);
        if (!leadId) continue;
        if (event.action === "handoff.reopened") {
          reopened.add(leadId);
          continue;
        }
        if (reopened.has(leadId)) continue;
        history.push({
          eventId: event.id,
          leadId,
          leadName: textValue(payload.lead_name) || "Lead",
          owner: textValue(payload.owner) || "Non indicato",
          resolution: textValue(payload.resolution) || "Esito non specificato",
          resolvedAt: event.created_at,
        });
      }
      setResolved(history);
    } catch {
      console.error("Unable to load human handoffs");
      setError("La coda dei passaggi umani non è disponibile.");
    } finally {
      setLoading(false);
    }
  }, [fallbackOwner, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const orderedLeads = useMemo(() => {
    const weight = { high: 0, normal: 1, low: 2 };
    return [...leads].sort((a, b) => {
      const priority = weight[(drafts[a.id]?.handoff_priority ?? "normal")] - weight[(drafts[b.id]?.handoff_priority ?? "normal")];
      if (priority !== 0) return priority;
      const dueA = Date.parse(drafts[a.id]?.handoff_due_at || "") || Number.MAX_SAFE_INTEGER;
      const dueB = Date.parse(drafts[b.id]?.handoff_due_at || "") || Number.MAX_SAFE_INTEGER;
      return dueA - dueB;
    });
  }, [drafts, leads]);

  const updateDraft = (leadId: string, patch: Partial<HandoffMetadata>) => {
    setDrafts((current) => ({
      ...current,
      [leadId]: { ...current[leadId], ...patch },
    }));
  };

  const saveAssignment = async (lead: HandoffLead) => {
    if (!tenantId) return;
    const draft = drafts[lead.id];
    if (!draft?.handoff_owner.trim() || !draft.handoff_reason.trim()) {
      toast.error("Indica responsabile e motivo del passaggio.");
      return;
    }
    setSavingId(lead.id);
    try {
      const nextPayload: Json = {
        ...jsonObject(lead.form_payload),
        handoff_owner: draft.handoff_owner.trim(),
        handoff_priority: draft.handoff_priority,
        handoff_due_at: draft.handoff_due_at || null,
        handoff_reason: draft.handoff_reason.trim(),
        handoff_state: "open",
        handoff_updated_at: new Date().toISOString(),
      };
      const { data, error: updateError } = await supabase
        .from("leads")
        .update({
          form_payload: nextPayload,
          next_action_at: draft.handoff_due_at || lead.next_action_at,
        })
        .eq("tenant_id", tenantId)
        .eq("id", lead.id)
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("Lead not found");

      const { error: auditError } = await supabase.from("audit_log").insert({
        tenant_id: tenantId,
        actor_user_id: user?.id ?? null,
        action: "handoff.assigned",
        payload_json: {
          lead_id: lead.id,
          lead_name: lead.name,
          owner: draft.handoff_owner.trim(),
          priority: draft.handoff_priority,
          due_at: draft.handoff_due_at || null,
          reason: draft.handoff_reason.trim(),
        },
      });
      if (auditError) throw auditError;
      toast.success("Passaggio umano aggiornato");
      await load();
    } catch {
      toast.error("Impossibile aggiornare il passaggio umano.");
    } finally {
      setSavingId(null);
    }
  };

  const resolveHandoff = async (lead: HandoffLead) => {
    if (!tenantId) return;
    const draft = drafts[lead.id];
    if (!draft?.handoff_owner.trim() || !draft.handoff_resolution.trim()) {
      toast.error("Indica responsabile ed esito finale.");
      return;
    }
    setSavingId(lead.id);
    try {
      const now = new Date().toISOString();
      const nextPayload: Json = {
        ...jsonObject(lead.form_payload),
        handoff_owner: draft.handoff_owner.trim(),
        handoff_priority: draft.handoff_priority,
        handoff_reason: draft.handoff_reason.trim(),
        handoff_state: "handled",
        handoff_resolution: draft.handoff_resolution.trim(),
        handoff_handled_at: now,
      };
      const { data, error: updateError } = await supabase
        .from("leads")
        .update({ handoff_status: null, next_action_at: null, form_payload: nextPayload })
        .eq("tenant_id", tenantId)
        .eq("id", lead.id)
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("Lead not found");

      const interactionResult = await supabase.from("interactions").insert({
        tenant_id: tenantId,
        lead_id: lead.id,
        channel: "manual",
        direction: "out",
        content: draft.handoff_resolution.trim(),
        outcome: "handoff_resolved",
        meta: { owner: draft.handoff_owner.trim(), resolved_at: now },
      });
      if (interactionResult.error) throw interactionResult.error;

      const { error: auditError } = await supabase.from("audit_log").insert({
        tenant_id: tenantId,
        actor_user_id: user?.id ?? null,
        action: "handoff.resolved",
        payload_json: {
          lead_id: lead.id,
          lead_name: lead.name,
          owner: draft.handoff_owner.trim(),
          resolution: draft.handoff_resolution.trim(),
          handled_at: now,
        },
      });
      if (auditError) throw auditError;
      toast.success("Passaggio umano chiuso");
      await load();
    } catch {
      toast.error("Impossibile chiudere il passaggio umano.");
    } finally {
      setSavingId(null);
    }
  };

  const reopenHandoff = async (item: ResolvedHandoff) => {
    if (!tenantId) return;
    setSavingId(item.leadId);
    try {
      const { data, error: updateError } = await supabase
        .from("leads")
        .update({ handoff_status: "HUMAN", next_action_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("id", item.leadId)
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("Lead not found");
      const { error: auditError } = await supabase.from("audit_log").insert({
        tenant_id: tenantId,
        actor_user_id: user?.id ?? null,
        action: "handoff.reopened",
        payload_json: { lead_id: item.leadId, previous_resolution_event_id: item.eventId },
      });
      if (auditError) throw auditError;
      toast.success("Passaggio riaperto");
      await load();
    } catch {
      toast.error("Impossibile riaprire il passaggio.");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[420px] flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Caricamento passaggi umani</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="secondary" className="mb-3">Coda operativa</Badge>
          <h1 className="text-2xl font-bold mb-1">Passaggi umani</h1>
          <p className="text-muted-foreground max-w-3xl">Motivo, contesto, responsabile, scadenza ed esito restano collegati al lead e alla sua conversazione.</p>
        </div>
        <Button variant="outline" onClick={() => void load()}><RefreshCw className="w-4 h-4 mr-2" />Aggiorna</Button>
      </div>

      {error && <Card className="border-destructive/30"><CardContent className="pt-6 flex gap-3"><AlertCircle className="w-5 h-5 text-destructive" /><p className="text-sm">{error}</p></CardContent></Card>}

      {orderedLeads.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" /><p className="font-medium">Nessun passaggio umano aperto</p><p className="text-sm text-muted-foreground mt-1">Gli elementi chiusi restano nella cronologia sottostante.</p></CardContent></Card>
      ) : (
        <div className="space-y-5">
          {orderedLeads.map((lead) => {
            const draft = drafts[lead.id] ?? metadataFor(lead, fallbackOwner);
            const leadInteractions = interactions.filter((item) => item.lead_id === lead.id).slice(0, 5);
            return (
              <Card key={lead.id} className={draft.handoff_priority === "high" ? "border-destructive/40" : undefined}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2"><UserRoundCheck className="w-5 h-5 text-primary" />{lead.name}</CardTitle>
                      <CardDescription className="mt-1">{lead.phone_e164 || lead.email || "Contatto non disponibile"} · stato {lead.status}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2"><Badge variant={draft.handoff_priority === "high" ? "destructive" : "secondary"}>{draft.handoff_priority}</Badge><Badge variant="outline"><Clock3 className="w-3 h-3 mr-1" />{elapsedLabel(lead.last_contact_at, lead.created_at)}</Badge></div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Responsabile</Label><Input value={draft.handoff_owner} onChange={(event) => updateDraft(lead.id, { handoff_owner: event.target.value })} maxLength={240} /></div>
                    <div className="space-y-2"><Label>Priorità</Label><Select value={draft.handoff_priority} onValueChange={(value) => updateDraft(lead.id, { handoff_priority: value as HandoffMetadata["handoff_priority"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">Alta</SelectItem><SelectItem value="normal">Normale</SelectItem><SelectItem value="low">Bassa</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>Scadenza</Label><Input type="datetime-local" value={draft.handoff_due_at ? draft.handoff_due_at.slice(0, 16) : ""} onChange={(event) => updateDraft(lead.id, { handoff_due_at: event.target.value ? new Date(event.target.value).toISOString() : "" })} /></div>
                  </div>
                  <div className="space-y-2"><Label>Motivo e contesto raccolto</Label><Textarea value={draft.handoff_reason} onChange={(event) => updateDraft(lead.id, { handoff_reason: event.target.value })} rows={3} maxLength={2000} /></div>

                  <div className="rounded-xl bg-muted/40 p-4">
                    <p className="text-sm font-medium mb-3">Ultime interazioni</p>
                    {leadInteractions.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna interazione disponibile.</p> : <div className="space-y-2">{leadInteractions.map((item) => <div key={item.id} className="text-sm border-l-2 border-primary/30 pl-3"><span className="font-medium">{item.channel} · {item.direction}</span><p className="text-muted-foreground mt-1">{item.content || item.outcome || "Nessun contenuto"}</p><span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("it-IT")}</span></div>)}</div>}
                  </div>

                  <div className="space-y-2"><Label>Esito finale</Label><Textarea value={draft.handoff_resolution} onChange={(event) => updateDraft(lead.id, { handoff_resolution: event.target.value })} rows={2} maxLength={1500} placeholder="Descrivi l'azione effettuata e l'esito comunicato al cliente." /></div>
                  <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => void saveAssignment(lead)} disabled={savingId === lead.id}><Save className="w-4 h-4 mr-2" />Salva assegnazione</Button><Button onClick={() => void resolveHandoff(lead)} disabled={savingId === lead.id || !draft.handoff_resolution.trim()}>{savingId === lead.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}Chiudi con esito</Button></div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Cronologia chiusure</CardTitle><CardDescription>Gli esiti restano disponibili nell'audit log e possono essere riaperti.</CardDescription></CardHeader>
        <CardContent>{resolved.length === 0 ? <p className="text-sm text-muted-foreground">Nessun passaggio chiuso registrato.</p> : <div className="divide-y">{resolved.map((item) => <div key={item.eventId} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><p className="font-medium">{item.leadName}</p><p className="text-sm text-muted-foreground mt-1">{item.resolution}</p><p className="text-xs text-muted-foreground mt-1">{item.owner} · {new Date(item.resolvedAt).toLocaleString("it-IT")}</p></div><Button size="sm" variant="outline" onClick={() => void reopenHandoff(item)} disabled={savingId === item.leadId}><RotateCcw className="w-4 h-4 mr-2" />Riapri</Button></div>)}</div>}</CardContent>
      </Card>
    </div>
  );
}
