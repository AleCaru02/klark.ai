import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock3,
  FileCheck2,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useKnowledge, type KnowledgeSource } from "@/hooks/useKnowledge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface GovernanceEvent {
  id: string;
  action: string;
  payload_json: Json | null;
  actor_user_id: string | null;
  created_at: string;
}

interface GovernanceEntry {
  eventId: string;
  sourceId: string;
  action: string;
  version: number | null;
  expiresAt: string | null;
  checksum: string | null;
  note: string | null;
  actorUserId: string | null;
  createdAt: string;
}

type GovernanceAction = "approved" | "reviewed" | "revoked";
type GovernanceRpc = (
  functionName: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

function jsonObject(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
}

function textValue(value: Json | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: Json | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, "0")).join("");
}

function defaultExpiry(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 90);
  return date.toISOString().slice(0, 10);
}

function statusPresentation(status: string, latest: GovernanceEntry | undefined) {
  if (status === "failed") return { label: "Errore elaborazione", variant: "destructive" as const };
  if (status === "processing" || status === "pending") return { label: "In elaborazione", variant: "secondary" as const };
  if (status === "pending_review") return { label: "Da approvare", variant: "secondary" as const };
  if (status === "completed" && latest?.action === "knowledge.source_approved") return { label: "Approvata e attiva", variant: "default" as const };
  if (status === "completed") return { label: "Attiva senza versione registrata", variant: "destructive" as const };
  return { label: status, variant: "secondary" as const };
}

export default function KnowledgeGovernance() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const { sources, isLoading, refetch } = useKnowledge();
  const [events, setEvents] = useState<GovernanceEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedSource, setSelectedSource] = useState<KnowledgeSource | null>(null);
  const [action, setAction] = useState<GovernanceAction>("approved");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!tenantId) {
      setLoadingHistory(false);
      return;
    }
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("audit_log")
      .select("id,action,payload_json,actor_user_id,created_at")
      .eq("tenant_id", tenantId)
      .in("action", [
        "knowledge.source_approved",
        "knowledge.source_reviewed",
        "knowledge.source_revoked",
        "knowledge.source_expired",
      ])
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      console.error("Unable to load knowledge governance history");
      toast.error("Cronologia knowledge base non disponibile.");
    } else {
      setEvents((data ?? []) as GovernanceEvent[]);
    }
    setLoadingHistory(false);
  }, [tenantId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const entries = useMemo<GovernanceEntry[]>(() => events.map((event) => {
    const payload = jsonObject(event.payload_json);
    return {
      eventId: event.id,
      sourceId: textValue(payload.source_id) || "",
      action: event.action,
      version: numberValue(payload.version),
      expiresAt: textValue(payload.expires_at),
      checksum: textValue(payload.checksum),
      note: textValue(payload.note),
      actorUserId: event.actor_user_id,
      createdAt: event.created_at,
    };
  }).filter((entry) => entry.sourceId), [events]);

  const latestBySource = useMemo(() => {
    const map = new Map<string, GovernanceEntry>();
    for (const entry of entries) {
      if (!map.has(entry.sourceId)) map.set(entry.sourceId, entry);
    }
    return map;
  }, [entries]);

  const openAction = (source: KnowledgeSource, nextAction: GovernanceAction) => {
    setSelectedSource(source);
    setAction(nextAction);
    setExpiresAt(defaultExpiry());
    setNote("");
  };

  const submitGovernance = async () => {
    if (!selectedSource) return;
    const status = String(selectedSource.status);
    if (action === "approved" && !["pending_review", "completed"].includes(status)) {
      toast.error("La fonte deve terminare l'elaborazione prima dell'approvazione.");
      return;
    }
    if (action === "approved" && !expiresAt) {
      toast.error("Indica una data di revisione o scadenza.");
      return;
    }

    setSaving(true);
    try {
      const checksum = await sha256([
        selectedSource.source_name,
        selectedSource.source_url || "",
        selectedSource.content_summary || "",
        selectedSource.content_text || "",
        selectedSource.updated_at,
      ].join("\n"));
      const rpc = (supabase as unknown as { rpc: GovernanceRpc }).rpc;
      const { error } = await rpc("set_knowledge_source_governance", {
        p_source_id: selectedSource.id,
        p_action: action,
        p_expires_at: action === "approved" ? new Date(`${expiresAt}T23:59:59.000Z`).toISOString() : null,
        p_checksum: checksum,
        p_note: note.trim() || null,
      });
      if (error) throw new Error(error.message || "Governance update failed");
      toast.success(
        action === "approved"
          ? "Fonte approvata e resa attiva"
          : action === "revoked"
            ? "Approvazione revocata"
            : "Revisione registrata",
      );
      setSelectedSource(null);
      await Promise.all([refetch(), loadHistory()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aggiornamento non completato.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loadingHistory) {
    return (
      <div className="min-h-[420px] flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Caricamento governance knowledge base</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="secondary" className="mb-3">Contenuti controllati</Badge>
          <h1 className="text-2xl font-bold mb-1">Governance knowledge base</h1>
          <p className="text-muted-foreground max-w-3xl">
            Le nuove fonti elaborate non vengono usate nelle chiamate finché un amministratore non registra approvazione, versione, checksum e scadenza.
          </p>
        </div>
        <Button variant="outline" onClick={() => void Promise.all([refetch(), loadHistory()])}><RefreshCw className="w-4 h-4 mr-2" />Aggiorna</Button>
      </div>

      {sources.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><FileCheck2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" /><p className="font-medium">Nessuna fonte caricata</p><p className="text-sm text-muted-foreground mt-1">Carica PDF o sito nella sezione Addestramento; dopo l'elaborazione compariranno qui.</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {sources.map((source) => {
            const latest = latestBySource.get(source.id);
            const presentation = statusPresentation(String(source.status), latest);
            const expired = latest?.expiresAt ? Date.parse(latest.expiresAt) <= Date.now() : false;
            return (
              <Card key={source.id} className={expired ? "border-destructive/40" : undefined}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{source.source_name}</CardTitle>
                      <CardDescription className="mt-1">{source.source_type} · aggiornata {new Date(source.updated_at).toLocaleString("it-IT")}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2"><Badge variant={presentation.variant}>{presentation.label}</Badge>{latest?.version ? <Badge variant="outline">Versione {latest.version}</Badge> : null}</div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{source.content_summary || source.error_message || "Nessun riepilogo disponibile."}</p>
                  {latest && (
                    <div className="grid sm:grid-cols-3 gap-3 rounded-xl bg-muted/40 p-4 text-sm">
                      <div><span className="text-muted-foreground block text-xs">Ultimo evento</span><strong>{latest.action.replace("knowledge.source_", "")}</strong></div>
                      <div><span className="text-muted-foreground block text-xs">Scadenza</span><strong>{latest.expiresAt ? new Date(latest.expiresAt).toLocaleDateString("it-IT") : "Non impostata"}</strong></div>
                      <div><span className="text-muted-foreground block text-xs">Checksum</span><strong className="font-mono text-xs">{latest.checksum ? `${latest.checksum.slice(0, 12)}…` : "Non registrato"}</strong></div>
                    </div>
                  )}
                  {expired && <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="w-4 h-4 mt-0.5" />L'approvazione risulta scaduta. La fonte deve restare fuori dal flusso AI finché non viene riesaminata.</div>}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => openAction(source, "reviewed")} disabled={String(source.status) === "processing"}><Clock3 className="w-4 h-4 mr-2" />Registra revisione</Button>
                    {String(source.status) === "completed" ? <Button size="sm" variant="destructive" onClick={() => openAction(source, "revoked")}><Ban className="w-4 h-4 mr-2" />Revoca</Button> : <Button size="sm" onClick={() => openAction(source, "approved")} disabled={!["pending_review", "completed"].includes(String(source.status))}><ShieldCheck className="w-4 h-4 mr-2" />Approva</Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="w-5 h-5 text-primary" />Cronologia versioni</CardTitle><CardDescription>Approvazioni, revisioni, revoche e scadenze registrate nel log immutabile del tenant.</CardDescription></CardHeader>
        <CardContent>{entries.length === 0 ? <p className="text-sm text-muted-foreground">Nessun evento di governance registrato.</p> : <div className="divide-y">{entries.map((entry) => <div key={entry.eventId} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2"><div><p className="font-medium">{entry.action.replace("knowledge.source_", "")} {entry.version ? `· v${entry.version}` : ""}</p><p className="text-sm text-muted-foreground mt-1">Fonte {entry.sourceId} {entry.note ? `· ${entry.note}` : ""}</p></div><span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString("it-IT")}</span></div>)}</div>}</CardContent>
      </Card>

      <Dialog open={Boolean(selectedSource)} onOpenChange={(open) => !open && setSelectedSource(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{action === "approved" ? "Approva fonte" : action === "revoked" ? "Revoca fonte" : "Registra revisione"}</DialogTitle><DialogDescription>{selectedSource?.source_name}. L'operazione viene versionata e attribuita all'utente autenticato.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-3">
            {action === "approved" && <div className="space-y-2"><Label htmlFor="knowledge-expiry">Valida fino al *</Label><Input id="knowledge-expiry" type="date" min={new Date().toISOString().slice(0, 10)} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></div>}
            <div className="space-y-2"><Label htmlFor="knowledge-note">Nota di revisione</Label><Textarea id="knowledge-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1000} placeholder="Controlli eseguiti, sezioni aggiornate o motivo della revoca." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSelectedSource(null)}>Annulla</Button><Button variant={action === "revoked" ? "destructive" : "default"} onClick={() => void submitGovernance()} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : action === "revoked" ? <Ban className="w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}{action === "approved" ? "Approva e attiva" : action === "revoked" ? "Revoca" : "Registra"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
