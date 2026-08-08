import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  PauseCircle,
  RefreshCw,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useServiceOperations } from "@/hooks/useServiceOperations";
import type { ServiceIssue } from "@/lib/serviceQuality";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface ResolutionDraft {
  cause: string;
  impact: string;
  solution: string;
  owner: string;
  prevention: string;
}

interface ResolvedIssue {
  eventId: string;
  issueId: string;
  title: string;
  severity: string;
  owner: string;
  solution: string;
  prevention: string;
  resolvedAt: string;
}

function jsonObject(value: unknown): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
}

function textValue(value: Json | undefined): string {
  return typeof value === "string" ? value : "";
}

const emptyDraft: ResolutionDraft = {
  cause: "",
  impact: "",
  solution: "",
  owner: "",
  prevention: "",
};

export default function QualityCenter() {
  const { membership, user } = useAuth();
  const tenantId = membership?.tenant_id;
  const { issues, snapshot, loading, error, refetch } = useServiceOperations(30);
  const [selectedIssue, setSelectedIssue] = useState<ServiceIssue | null>(null);
  const [draft, setDraft] = useState<ResolutionDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [suspending, setSuspending] = useState(false);

  const counts = useMemo(() => ({
    P1: issues.filter((issue) => issue.severity === "P1").length,
    P2: issues.filter((issue) => issue.severity === "P2").length,
    P3: issues.filter((issue) => issue.severity === "P3").length,
  }), [issues]);

  const resolved = useMemo(() => {
    const items: ResolvedIssue[] = [];
    for (const event of snapshot?.auditEvents ?? []) {
      if (event.action !== "service_issue.resolved") continue;
      const payload = jsonObject(event.payload_json);
      const issueId = textValue(payload.issue_id);
      if (!issueId) continue;
      items.push({
        eventId: event.id,
        issueId,
        title: textValue(payload.title) || "Problema operativo",
        severity: textValue(payload.severity) || "P3",
        owner: textValue(payload.owner) || "Non indicato",
        solution: textValue(payload.solution) || "Non indicata",
        prevention: textValue(payload.prevention) || "Non indicata",
        resolvedAt: event.created_at,
      });
    }
    return items;
  }, [snapshot]);

  const openResolution = (issue: ServiceIssue) => {
    setSelectedIssue(issue);
    setDraft({ ...emptyDraft, owner: user?.email || "" });
  };

  const saveResolution = async () => {
    if (!tenantId || !selectedIssue) return;
    if (!draft.cause.trim() || !draft.impact.trim() || !draft.solution.trim() || !draft.owner.trim() || !draft.prevention.trim()) {
      toast.error("Compila causa, impatto, soluzione, responsabile e prevenzione.");
      return;
    }
    setSaving(true);
    try {
      const { error: auditError } = await supabase.from("audit_log").insert({
        tenant_id: tenantId,
        actor_user_id: user?.id ?? null,
        action: "service_issue.resolved",
        payload_json: {
          issue_id: selectedIssue.id,
          source_id: selectedIssue.sourceId,
          area: selectedIssue.area,
          severity: selectedIssue.severity,
          title: selectedIssue.title,
          cause: draft.cause.trim(),
          impact: draft.impact.trim(),
          solution: draft.solution.trim(),
          owner: draft.owner.trim(),
          prevention: draft.prevention.trim(),
          resolved_at: new Date().toISOString(),
        },
      });
      if (auditError) throw auditError;
      toast.success("Incidente chiuso e registrato");
      setSelectedIssue(null);
      setDraft(emptyDraft);
      await refetch();
    } catch {
      toast.error("Impossibile registrare la risoluzione.");
    } finally {
      setSaving(false);
    }
  };

  const suspendRiskyAutomations = async () => {
    if (!tenantId) return;
    const confirmed = window.confirm(
      "Sospendere voce, WhatsApp e prenotazione calendario? Le automazioni resteranno disabilitate finché un amministratore non le riattiva.",
    );
    if (!confirmed) return;
    setSuspending(true);
    try {
      const { data, error: updateError } = await supabase
        .from("settings")
        .update({ voice_enabled: false, whatsapp_enabled: false, calendar_enabled: false })
        .eq("tenant_id", tenantId)
        .select("tenant_id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("Settings not found");
      const { error: auditError } = await supabase.from("audit_log").insert({
        tenant_id: tenantId,
        actor_user_id: user?.id ?? null,
        action: "service.emergency_suspension",
        payload_json: {
          disabled_channels: ["voice", "whatsapp", "calendar"],
          reason: "Manual suspension from Quality Center",
          suspended_at: new Date().toISOString(),
        },
      });
      if (auditError) throw auditError;
      toast.success("Automazioni sospese");
      await refetch();
    } catch {
      toast.error("Sospensione non completata.");
    } finally {
      setSuspending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[420px] flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Caricamento centro qualità</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="secondary" className="mb-3">Controllo operativo</Badge>
          <h1 className="text-2xl font-bold mb-1">Qualità e incidenti</h1>
          <p className="text-muted-foreground max-w-3xl">
            Conversazioni anomale, errori provider e problemi di sincronizzazione diventano attività con causa, impatto, soluzione e prevenzione.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refetch()}><RefreshCw className="w-4 h-4 mr-2" />Aggiorna</Button>
          <Button variant="destructive" onClick={() => void suspendRiskyAutomations()} disabled={suspending}>
            {suspending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PauseCircle className="w-4 h-4 mr-2" />}
            Sospensione di emergenza
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30"><CardContent className="pt-6 flex items-start gap-3"><AlertCircle className="w-5 h-5 text-destructive" /><p className="text-sm">{error}</p></CardContent></Card>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="border-destructive/40"><CardHeader className="pb-2"><CardDescription>P1 · Critici</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold">{counts.P1}</p><p className="text-xs text-muted-foreground mt-1">Sicurezza, webhook o servizio indisponibile</p></CardContent></Card>
        <Card className="border-amber-500/40"><CardHeader className="pb-2"><CardDescription>P2 · Prioritari</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold">{counts.P2}</p><p className="text-xs text-muted-foreground mt-1">Provider, calendario, messaggi o retry</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>P3 · Miglioramento</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold">{counts.P3}</p><p className="text-xs text-muted-foreground mt-1">Singole conversazioni o dati incompleti</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Problemi aperti</CardTitle><CardDescription>La classificazione deriva da condizioni tecniche esplicite negli ultimi 30 giorni.</CardDescription></CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <div className="py-10 text-center"><CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" /><p className="font-medium">Nessun problema aperto rilevato</p><p className="text-sm text-muted-foreground mt-1">Il collaudo end-to-end dei provider resta comunque obbligatorio.</p></div>
          ) : (
            <div className="space-y-3">
              {issues.map((issue) => (
                <div key={issue.id} className="rounded-xl border p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className={issue.severity === "P1" ? "w-5 h-5 text-destructive mt-0.5" : "w-5 h-5 text-amber-600 mt-0.5"} aria-hidden="true" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{issue.title}</p><Badge variant={issue.severity === "P1" ? "destructive" : "secondary"}>{issue.severity}</Badge><Badge variant="outline">{issue.area}</Badge></div>
                      <p className="text-sm text-muted-foreground mt-1">{issue.detail}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(issue.occurredAt).toLocaleString("it-IT")}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild><Link to={issue.actionPath}>Apri origine <ExternalLink className="w-3 h-3 ml-2" /></Link></Button>
                    <Button size="sm" onClick={() => openResolution(issue)}><Wrench className="w-4 h-4 mr-2" />Gestisci</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Incidenti chiusi</CardTitle><CardDescription>Registro delle risoluzioni e delle misure preventive.</CardDescription></CardHeader>
        <CardContent>
          {resolved.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna risoluzione registrata nel periodo.</p> : <div className="divide-y">{resolved.map((item) => <div key={item.eventId} className="py-4"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.title}</p><Badge variant="outline">{item.severity}</Badge></div><p className="text-sm mt-2"><strong>Soluzione:</strong> {item.solution}</p><p className="text-sm text-muted-foreground mt-1"><strong>Prevenzione:</strong> {item.prevention}</p><p className="text-xs text-muted-foreground mt-2">{item.owner} · {new Date(item.resolvedAt).toLocaleString("it-IT")}</p></div>)}</div>}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedIssue)} onOpenChange={(open) => !open && setSelectedIssue(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Gestisci incidente {selectedIssue?.severity}</DialogTitle><DialogDescription>{selectedIssue?.title}. La chiusura richiede tutti i campi.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="grid md:grid-cols-2 gap-4"><div className="space-y-2"><Label>Causa</Label><Textarea value={draft.cause} onChange={(event) => setDraft((current) => ({ ...current, cause: event.target.value }))} rows={3} maxLength={1200} /></div><div className="space-y-2"><Label>Impatto</Label><Textarea value={draft.impact} onChange={(event) => setDraft((current) => ({ ...current, impact: event.target.value }))} rows={3} maxLength={1200} /></div></div>
            <div className="space-y-2"><Label>Soluzione applicata</Label><Textarea value={draft.solution} onChange={(event) => setDraft((current) => ({ ...current, solution: event.target.value }))} rows={3} maxLength={1600} /></div>
            <div className="grid md:grid-cols-2 gap-4"><div className="space-y-2"><Label>Responsabile</Label><Input value={draft.owner} onChange={(event) => setDraft((current) => ({ ...current, owner: event.target.value }))} maxLength={240} /></div><div className="space-y-2"><Label>Misura preventiva</Label><Textarea value={draft.prevention} onChange={(event) => setDraft((current) => ({ ...current, prevention: event.target.value }))} rows={3} maxLength={1200} /></div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSelectedIssue(null)}>Annulla</Button><Button onClick={() => void saveResolution()} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}Chiudi incidente</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
