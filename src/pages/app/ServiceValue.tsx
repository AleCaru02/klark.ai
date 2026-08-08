import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  PhoneCall,
  RefreshCw,
  UserRoundCheck,
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useServiceOperations } from "@/hooks/useServiceOperations";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";

function displayRate(value: number | null): string {
  return value === null ? "N/D" : `${value}%`;
}

function displayMinutes(value: number | null): string {
  return value === null ? "N/D" : `${value} min`;
}

function jsonObject(value: unknown): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
}

function numberValue(value: Json | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: Json | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function stringArray(value: Json | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default function ServiceValue() {
  const { metrics, issues, snapshot, loading, error, refetch } = useServiceOperations(30);

  if (loading) {
    return (
      <div className="min-h-[420px] flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Caricamento valore del servizio</span>
      </div>
    );
  }

  const reportRows: Record<string, unknown>[] = [
    { indicatore: "Richieste ricevute", valore: metrics.requestsReceived, periodo: "Ultimi 30 giorni" },
    { indicatore: "Flussi chiusi", valore: metrics.closedWorkflows, periodo: "Ultimi 30 giorni" },
    { indicatore: "Chiamate tracciate", valore: metrics.callsTracked, periodo: "Ultimi 30 giorni" },
    { indicatore: "Chiamate connesse", valore: metrics.connectedCalls, periodo: "Ultimi 30 giorni" },
    { indicatore: "Tasso di connessione", valore: displayRate(metrics.connectionRate), periodo: "Ultimi 30 giorni" },
    { indicatore: "Copertura esiti", valore: displayRate(metrics.structuredOutcomeRate), periodo: "Ultimi 30 giorni" },
    { indicatore: "Appuntamenti creati", valore: metrics.appointmentsCreated, periodo: "Ultimi 30 giorni" },
    { indicatore: "Appuntamenti spostati", valore: metrics.appointmentsRescheduled, periodo: "Ultimi 30 giorni" },
    { indicatore: "Appuntamenti cancellati", valore: metrics.appointmentsCancelled, periodo: "Ultimi 30 giorni" },
    { indicatore: "Messaggi tracciati", valore: metrics.messagesTracked, periodo: "Ultimi 30 giorni" },
    { indicatore: "Tasso passaggio umano", valore: displayRate(metrics.humanHandoffRate), periodo: "Ultimi 30 giorni" },
    { indicatore: "Prima risposta media", valore: displayMinutes(metrics.averageFirstResponseMinutes), periodo: "Ultimi 30 giorni" },
    { indicatore: "Follow-up attivi", valore: metrics.activeFollowups, periodo: "Stato attuale" },
    { indicatore: "Problemi P1/P2 aperti", valore: metrics.providerFailures, periodo: "Stato attuale" },
    { indicatore: "Interventi registrati", valore: metrics.recordedInterventions, periodo: "Ultimi 30 giorni" },
  ];

  const monthlyEvent = (snapshot?.auditEvents ?? []).find((event) => event.action === "service_report.monthly_generated");
  const monthlyPayload = jsonObject(monthlyEvent?.payload_json);
  const monthlyResults = jsonObject(monthlyPayload.results);
  const monthlyQuality = jsonObject(monthlyPayload.quality);
  const monthlyActivities = jsonObject(monthlyPayload.activities);
  const monthlyPlan = stringArray(monthlyPayload.next_month_plan);
  const monthlyReportRows: Record<string, unknown>[] = monthlyEvent
    ? [
        { sezione: "Risultati", indicatore: "Richieste ricevute", valore: numberValue(monthlyResults.requests_received) ?? 0 },
        { sezione: "Risultati", indicatore: "Flussi chiusi", valore: numberValue(monthlyResults.closed_workflows) ?? 0 },
        { sezione: "Risultati", indicatore: "Chiamate connesse", valore: numberValue(monthlyResults.calls_connected) ?? 0 },
        { sezione: "Risultati", indicatore: "Appuntamenti creati", valore: numberValue(monthlyResults.appointments_created) ?? 0 },
        { sezione: "Qualità", indicatore: "Passaggi umani", valore: numberValue(monthlyQuality.human_handoffs) ?? 0 },
        { sezione: "Qualità", indicatore: "Errori provider", valore: numberValue(monthlyQuality.provider_error_events) ?? 0 },
        { sezione: "Attività", indicatore: "Eventi knowledge", valore: numberValue(monthlyActivities.knowledge_events) ?? 0 },
        { sezione: "Attività", indicatore: "Modifiche configurazione", valore: numberValue(monthlyActivities.configuration_events) ?? 0 },
        ...monthlyPlan.map((item) => ({ sezione: "Piano mese successivo", indicatore: item, valore: "Da eseguire" })),
      ]
    : [];

  const activityRows = (snapshot?.auditEvents ?? [])
    .filter((event) => event.action !== "service_report.monthly_generated")
    .slice(0, 12)
    .map((event) => ({
      data: new Date(event.created_at).toLocaleString("it-IT"),
      attivita: event.action,
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="secondary" className="mb-3">Dati reali · ultimi 30 giorni</Badge>
          <h1 className="text-2xl font-bold mb-1">Valore e attività del servizio</h1>
          <p className="text-muted-foreground max-w-3xl">
            Risultati, qualità e lavoro registrato. Nessun risparmio o risultato viene stimato in assenza di record verificabili.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />Aggiorna
          </Button>
          <Button variant="outline" onClick={() => exportToCSV(reportRows, "clark-report-servizio-30-giorni")}>
            <Download className="w-4 h-4 mr-2" aria-hidden="true" />CSV
          </Button>
          <Button onClick={() => exportToPDF(reportRows, "clark-report-servizio-30-giorni", "Report operativo Clark.ai") }>
            <FileText className="w-4 h-4 mr-2" aria-hidden="true" />PDF 30 giorni
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" aria-hidden="true" />
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Richieste ricevute</CardDescription></CardHeader><CardContent><div className="flex items-center justify-between"><span className="text-3xl font-bold">{metrics.requestsReceived}</span><PhoneCall className="w-6 h-6 text-primary" /></div><p className="text-xs text-muted-foreground mt-2">{metrics.closedWorkflows} flussi chiusi</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Appuntamenti</CardDescription></CardHeader><CardContent><div className="flex items-center justify-between"><span className="text-3xl font-bold">{metrics.appointmentsCreated}</span><CalendarCheck className="w-6 h-6 text-primary" /></div><p className="text-xs text-muted-foreground mt-2">{metrics.appointmentsRescheduled} spostati · {metrics.appointmentsCancelled} cancellati</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Messaggi tracciati</CardDescription></CardHeader><CardContent><div className="flex items-center justify-between"><span className="text-3xl font-bold">{metrics.messagesTracked}</span><MessageCircle className="w-6 h-6 text-primary" /></div><p className="text-xs text-muted-foreground mt-2">solo invii presenti nei log</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Passaggi umani aperti</CardDescription></CardHeader><CardContent><div className="flex items-center justify-between"><span className="text-3xl font-bold">{metrics.humanHandoffs}</span><UserRoundCheck className="w-6 h-6 text-primary" /></div><Button variant="link" className="px-0 h-auto mt-2" asChild><Link to="/app/handoffs">Apri la coda <ArrowRight className="w-3 h-3 ml-1" /></Link></Button></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />Copertura e tempi</CardTitle><CardDescription>Indicatori calcolati dai record del tenant.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div><div className="flex justify-between text-sm mb-2"><span>Tasso di connessione</span><strong>{displayRate(metrics.connectionRate)}</strong></div><Progress value={metrics.connectionRate ?? 0} /></div>
            <div><div className="flex justify-between text-sm mb-2"><span>Chiamate con esito strutturato</span><strong>{displayRate(metrics.structuredOutcomeRate)}</strong></div><Progress value={metrics.structuredOutcomeRate ?? 0} /></div>
            <div><div className="flex justify-between text-sm mb-2"><span>Passaggio umano</span><strong>{displayRate(metrics.humanHandoffRate)}</strong></div><Progress value={metrics.humanHandoffRate ?? 0} /></div>
            <div className="rounded-xl bg-muted/50 p-4 flex items-start gap-3"><Clock3 className="w-5 h-5 text-primary mt-0.5" /><div><p className="font-medium text-sm">Prima risposta media: {displayMinutes(metrics.averageFirstResponseMinutes)}</p><p className="text-xs text-muted-foreground mt-1">Calcolata dal primo messaggio in uscita associato al lead.</p></div></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Qualità e continuità</CardTitle><CardDescription>Problemi aperti determinati da chiamate, provider, sincronizzazioni e reminder.</CardDescription></CardHeader>
          <CardContent>
            {issues.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center"><CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-3" /><p className="font-medium">Nessun problema rilevato nel campione</p><p className="text-sm text-muted-foreground mt-1">Questo non sostituisce il collaudo end-to-end.</p></div>
            ) : (
              <div className="space-y-3">{issues.slice(0, 5).map((issue) => <div key={issue.id} className="rounded-xl border p-3 flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{issue.title}</p><p className="text-xs text-muted-foreground mt-1">{issue.detail}</p></div><Badge variant={issue.severity === "P1" ? "destructive" : "secondary"}>{issue.severity}</Badge></div>)}<Button variant="outline" className="w-full" asChild><Link to="/app/quality">Apri Qualità e incidenti</Link></Button></div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><CardTitle>Report mensile automatico</CardTitle><CardDescription>Generato il primo giorno del mese precedente e salvato nel registro del tenant.</CardDescription></div>
            {monthlyEvent && <Button variant="outline" onClick={() => exportToPDF(monthlyReportRows, `clark-report-mensile-${stringValue(monthlyPayload.report_month) || "ultimo"}`, "Report mensile Clark.ai")}><FileText className="w-4 h-4 mr-2" />Esporta report mensile</Button>}
          </div>
        </CardHeader>
        <CardContent>
          {!monthlyEvent ? (
            <p className="text-sm text-muted-foreground">Nessun report mensile ancora disponibile. Il sistema genera report soltanto per tenant con abbonamento attivo.</p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2"><Badge>{stringValue(monthlyPayload.report_month) || "Mese non disponibile"}</Badge><Badge variant="outline">Generato {new Date(monthlyEvent.created_at).toLocaleString("it-IT")}</Badge></div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <ReportSection title="Risultati" values={[`Richieste: ${numberValue(monthlyResults.requests_received) ?? 0}`, `Flussi chiusi: ${numberValue(monthlyResults.closed_workflows) ?? 0}`, `Appuntamenti: ${numberValue(monthlyResults.appointments_created) ?? 0}`]} />
                <ReportSection title="Qualità" values={[`Handoff: ${numberValue(monthlyQuality.human_handoffs) ?? 0}`, `Errori provider: ${numberValue(monthlyQuality.provider_error_events) ?? 0}`, `Messaggi falliti: ${numberValue(monthlyQuality.failed_messages) ?? 0}`]} />
                <ReportSection title="Attività" values={[`Knowledge: ${numberValue(monthlyActivities.knowledge_events) ?? 0}`, `Configurazioni: ${numberValue(monthlyActivities.configuration_events) ?? 0}`, `Test: ${numberValue(monthlyActivities.test_events) ?? 0}`]} />
                <ReportSection title="Piano successivo" values={monthlyPlan.length > 0 ? monthlyPlan : ["Nessuna azione registrata"]} />
              </div>
              <p className="text-xs text-muted-foreground">L'invio email è disattivato finché non viene configurato un mittente transazionale verificato.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Attività registrate</CardTitle><CardDescription>Ultimi eventi di configurazione, automazione e controllo.</CardDescription></CardHeader>
        <CardContent>{activityRows.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna attività registrata nel periodo.</p> : <div className="divide-y">{activityRows.map((row, index) => <div key={`${row.data}-${index}`} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"><span className="text-sm font-medium">{row.attivita}</span><span className="text-xs text-muted-foreground">{row.data}</span></div>)}</div>}</CardContent>
      </Card>
    </div>
  );
}

function ReportSection({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="rounded-xl border p-4">
      <h2 className="font-semibold mb-3">{title}</h2>
      <ul className="space-y-2">{values.map((value) => <li key={value} className="text-sm text-muted-foreground flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />{value}</li>)}</ul>
    </div>
  );
}
