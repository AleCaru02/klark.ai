import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Bot, Calculator, CheckCircle2, Clock3, Loader2, PhoneCall, Save, Settings2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchIntegrationStatus, type IntegrationStatus } from "@/hooks/useIntegrationStatus";
import { defaultMetaLeadFollowup, launchChecks, providerArchitecture, sectorPresets } from "@/config/automation";
import { DEFAULT_TECHNICAL_COST_EUR_PER_MINUTE, estimatePlanEconomics, getPlan, plans, type PlanCode } from "@/config/plans";

const emptyStatus: IntegrationStatus = {
  tenant_id: null,
  google: { connected: false },
  facebook: { connected: false },
  whatsapp: { connected: false },
};

type StoredConfig = Record<string, unknown>;

type StudioState = {
  advancedMode: boolean;
  planCode: PlanCode;
  sectorCode: string;
  usedMinutes: number;
  costPerMinute: number;
  fixedCost: number;
  startHour: string;
  endHour: string;
  maxCallsPerDay: number;
  maxCallsTotal: number;
  firstCallDelay: number;
  messageDelay: number;
};

const initialState: StudioState = {
  advancedMode: false,
  planCode: "growth",
  sectorCode: "b2b",
  usedMinutes: 650,
  costPerMinute: DEFAULT_TECHNICAL_COST_EUR_PER_MINUTE,
  fixedCost: 58,
  startHour: defaultMetaLeadFollowup.allowedStartHour,
  endHour: defaultMetaLeadFollowup.allowedEndHour,
  maxCallsPerDay: defaultMetaLeadFollowup.maxCallsPerDay,
  maxCallsTotal: defaultMetaLeadFollowup.maxCallsTotal,
  firstCallDelay: 1,
  messageDelay: 2,
};

function stringValue(source: StoredConfig, key: string, fallback: string) {
  return typeof source[key] === "string" ? (source[key] as string) : fallback;
}

function numberValue(source: StoredConfig, key: string, fallback: number) {
  return typeof source[key] === "number" && Number.isFinite(source[key]) ? (source[key] as number) : fallback;
}

function boolValue(source: StoredConfig, key: string) {
  return source[key] === true;
}

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

export default function AutomationStudio() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stored, setStored] = useState<StoredConfig>({});
  const [status, setStatus] = useState<IntegrationStatus>(emptyStatus);
  const [voiceNumberAssigned, setVoiceNumberAssigned] = useState(false);
  const [studio, setStudio] = useState<StudioState>(initialState);

  useEffect(() => {
    const load = async () => {
      if (!tenantId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [settingsResult, integrationResult] = await Promise.all([
          supabase.from("settings").select("voice_number,ai_prompt_json").eq("tenant_id", tenantId).maybeSingle(),
          fetchIntegrationStatus(),
        ]);
        if (settingsResult.error) throw settingsResult.error;
        if (!settingsResult.data) throw new Error("Configurazione tenant non inizializzata");

        const prompt = (settingsResult.data.ai_prompt_json ?? {}) as StoredConfig;
        const automation = (prompt.automation_studio ?? {}) as StoredConfig;
        const candidatePlan = stringValue(automation, "plan_code", "growth");
        const planCode = plans.some((plan) => plan.code === candidatePlan) ? (candidatePlan as PlanCode) : "growth";

        setStored(prompt);
        setVoiceNumberAssigned(Boolean(settingsResult.data.voice_number));
        setStatus(integrationResult);
        setStudio({
          advancedMode: boolValue(automation, "advanced_mode"),
          planCode,
          sectorCode: stringValue(automation, "sector_code", "b2b"),
          usedMinutes: numberValue(automation, "used_minutes", getPlan(planCode).includedVoiceMinutes ?? 0),
          costPerMinute: numberValue(automation, "technical_cost_per_minute", DEFAULT_TECHNICAL_COST_EUR_PER_MINUTE),
          fixedCost: numberValue(automation, "fixed_cost_month", getPlan(planCode).estimatedFixedCostMonth),
          startHour: stringValue(automation, "allowed_start_hour", defaultMetaLeadFollowup.allowedStartHour),
          endHour: stringValue(automation, "allowed_end_hour", defaultMetaLeadFollowup.allowedEndHour),
          maxCallsPerDay: numberValue(automation, "max_calls_per_day", defaultMetaLeadFollowup.maxCallsPerDay),
          maxCallsTotal: numberValue(automation, "max_calls_total", defaultMetaLeadFollowup.maxCallsTotal),
          firstCallDelay: numberValue(automation, "first_call_delay_minutes", 1),
          messageDelay: numberValue(automation, "missed_call_message_delay_minutes", 2),
        });
      } catch (error) {
        console.error("Unable to load Automation Studio", error);
        toast.error("Configurazione non caricata.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [tenantId]);

  const plan = getPlan(studio.planCode);
  const sector = sectorPresets.find((item) => item.code === studio.sectorCode) ?? sectorPresets[0];
  const economics = useMemo(
    () => estimatePlanEconomics(plan, Math.max(0, studio.usedMinutes), Math.max(0, studio.costPerMinute), Math.max(0, studio.fixedCost)),
    [plan, studio.usedMinutes, studio.costPerMinute, studio.fixedCost],
  );

  const readiness = useMemo(() => {
    const values: Record<string, boolean> = {
      identity: Boolean(stored.studio_name && stored.profession),
      twilio: voiceNumberAssigned,
      elevenlabs: boolValue(stored, "elevenlabs_verified"),
      openai: boolValue(stored, "openai_verified"),
      google: status.google.connected,
      meta_leads: status.facebook.connected,
      whatsapp: status.whatsapp.connected,
      knowledge: boolValue(stored, "knowledge_approved"),
      stripe: boolValue(stored, "stripe_live_verified"),
      email: boolValue(stored, "transactional_email_verified"),
      privacy: boolValue(stored, "privacy_approved"),
      e2e: boolValue(stored, "e2e_verified"),
      approval: boolValue(stored, "production_readiness_approved"),
    };
    const optional = new Set<string>(studio.planCode === "essential" ? ["meta_leads", "whatsapp"] : []);
    const required = launchChecks.filter((check) => !optional.has(check.code));
    const passed = required.filter((check) => values[check.code]).length;
    return { values, optional, passed, total: required.length, percent: Math.round((passed / required.length) * 100), ready: passed === required.length };
  }, [stored, status, studio.planCode, voiceNumberAssigned]);

  const patchStudio = <K extends keyof StudioState>(key: K, value: StudioState[K]) => {
    setStudio((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (!tenantId) return;
    if (studio.maxCallsPerDay < 1 || studio.maxCallsPerDay > 2) {
      toast.error("Sono consentite al massimo 2 chiamate automatiche al giorno.");
      return;
    }
    if (studio.maxCallsTotal < studio.maxCallsPerDay || studio.maxCallsTotal > 10) {
      toast.error("I tentativi totali devono essere compresi tra il limite giornaliero e 10.");
      return;
    }
    if (studio.startHour >= studio.endHour) {
      toast.error("La fascia iniziale deve precedere quella finale.");
      return;
    }

    setSaving(true);
    try {
      const nextPrompt = {
        ...stored,
        sector_preset: sector,
        followup_preset: {
          ...defaultMetaLeadFollowup,
          allowedStartHour: studio.startHour,
          allowedEndHour: studio.endHour,
          maxCallsPerDay: studio.maxCallsPerDay,
          maxCallsTotal: studio.maxCallsTotal,
          firstCallDelayMinutes: studio.firstCallDelay,
          missedCallMessageDelayMinutes: studio.messageDelay,
        },
        automation_studio: {
          version: 1,
          advanced_mode: studio.advancedMode,
          plan_code: studio.planCode,
          sector_code: studio.sectorCode,
          used_minutes: studio.usedMinutes,
          technical_cost_per_minute: studio.costPerMinute,
          fixed_cost_month: studio.fixedCost,
          allowed_start_hour: studio.startHour,
          allowed_end_hour: studio.endHour,
          max_calls_per_day: studio.maxCallsPerDay,
          max_calls_total: studio.maxCallsTotal,
          first_call_delay_minutes: studio.firstCallDelay,
          missed_call_message_delay_minutes: studio.messageDelay,
          updated_at: new Date().toISOString(),
        },
      };
      const result = await supabase
        .from("settings")
        .update({ ai_prompt_json: nextPrompt as never })
        .eq("tenant_id", tenantId)
        .select("tenant_id")
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("Configurazione tenant non trovata");
      setStored(nextPrompt);
      toast.success("Automation Studio salvato.");
    } catch (error) {
      console.error("Unable to save Automation Studio", error);
      toast.error("Configurazione non salvata.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
        <div>
          <Badge variant="secondary" className="mb-3">Configurazione tenant</Badge>
          <h1 className="text-3xl font-bold">Automation Studio</h1>
          <p className="text-muted-foreground mt-2 max-w-3xl">Settore, follow-up, unit economics e prontezza al lancio in una sola configurazione.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div><p className="text-sm font-medium">Modalità avanzata</p><p className="text-xs text-muted-foreground">Mostra costi e limiti tecnici</p></div>
          <Switch checked={studio.advancedMode} onCheckedChange={(value) => patchStudio("advancedMode", value)} aria-label="Attiva modalità avanzata" />
        </div>
      </header>

      <div className="grid xl:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Piano e settore</CardTitle><CardDescription>Il preset è una base modificabile, non un flusso rigido.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Piano</Label>
              <Select value={studio.planCode} onValueChange={(value) => {
                const next = value as PlanCode;
                patchStudio("planCode", next);
                patchStudio("usedMinutes", getPlan(next).includedVoiceMinutes ?? 0);
                patchStudio("fixedCost", getPlan(next).estimatedFixedCostMonth);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{plans.map((item) => <SelectItem key={item.code} value={item.code}>{item.name} · {item.priceMonth}€/mese</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preset settore</Label>
              <Select value={studio.sectorCode} onValueChange={(value) => patchStudio("sectorCode", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{sectorPresets.map((item) => <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="rounded-xl bg-muted/60 p-4 space-y-3">
              <p className="font-semibold">{sector.name}</p>
              <p className="text-sm text-muted-foreground">{sector.description}</p>
              <p className="text-xs"><strong>Durata proposta:</strong> {sector.defaultAppointmentMinutes} minuti</p>
              <div className="flex flex-wrap gap-1.5">{sector.intents.slice(0, 6).map((intent) => <Badge key={intent} variant="outline">{intent}</Badge>)}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><PhoneCall className="w-5 h-5 text-primary" /> Follow-up Lead Meta</CardTitle><CardDescription>Sequenza standard con limiti, fasce e condizioni di stop.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Dalle"><Input type="time" value={studio.startHour} onChange={(event) => patchStudio("startHour", event.target.value)} /></Field>
              <Field label="Alle"><Input type="time" value={studio.endHour} onChange={(event) => patchStudio("endHour", event.target.value)} /></Field>
              <Field label="Chiamate/giorno"><Input type="number" min={1} max={2} value={studio.maxCallsPerDay} onChange={(event) => patchStudio("maxCallsPerDay", Number(event.target.value))} /></Field>
              <Field label="Tentativi totali"><Input type="number" min={1} max={10} value={studio.maxCallsTotal} onChange={(event) => patchStudio("maxCallsTotal", Number(event.target.value))} /></Field>
            </div>
            {studio.advancedMode && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Prima chiamata dopo (min)"><Input type="number" min={1} max={60} value={studio.firstCallDelay} onChange={(event) => patchStudio("firstCallDelay", Number(event.target.value))} /></Field>
                <Field label="WhatsApp dopo mancata risposta (min)"><Input type="number" min={1} max={120} value={studio.messageDelay} onChange={(event) => patchStudio("messageDelay", Number(event.target.value))} /></Field>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-3">
              {defaultMetaLeadFollowup.steps.map((step, index) => (
                <div key={`${step.day}-${step.offsetMinutes}-${step.channel}`} className="flex gap-3 rounded-xl border border-border p-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{index + 1}</div>
                  <div><p className="text-sm font-medium">Giorno {step.day} · {step.channel}</p><p className="text-xs text-muted-foreground mt-1">{step.action}</p></div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Stop immediato</p>
              <p className="text-xs text-muted-foreground mt-2">Risposta, prenotazione, richiamata concordata, opt-out, numero errato, richiesta di una persona o conversazione manuale aperta.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {studio.advancedMode && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="w-5 h-5 text-primary" /> Economics Center</CardTitle><CardDescription>Stima tecnica, non contabilità fiscale.</CardDescription></CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Field label="Minuti previsti/usati"><Input type="number" min={0} value={studio.usedMinutes} onChange={(event) => patchStudio("usedMinutes", Number(event.target.value))} /></Field>
              <Field label="Costo tecnico €/min"><Input type="number" min={0} step="0.01" value={studio.costPerMinute} onChange={(event) => patchStudio("costPerMinute", Number(event.target.value))} /></Field>
              <Field label="Costi fissi mensili"><Input type="number" min={0} value={studio.fixedCost} onChange={(event) => patchStudio("fixedCost", Number(event.target.value))} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Metric label="Ricavo stimato" value={euro(economics.revenue)} />
              <Metric label="Costo tecnico" value={euro(economics.estimatedCost)} />
              <Metric label="Margine lordo" value={euro(economics.grossMargin)} />
              <Metric label="Margine %" value={`${economics.grossMarginPercent.toFixed(1)}%`} />
              <Metric label="Minuti extra" value={String(economics.extraMinutes)} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Prontezza al lancio</CardTitle><CardDescription>Il pulsante produzione resta bloccato finché i requisiti del piano non sono verificati.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4"><Progress value={readiness.percent} className="flex-1" /><span className="text-sm font-semibold">{readiness.passed}/{readiness.total}</span></div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {launchChecks.map((check) => {
              const passed = readiness.values[check.code];
              const optional = readiness.optional.has(check.code);
              return (
                <div key={check.code} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  {passed ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : optional ? <Clock3 className="w-5 h-5 text-muted-foreground shrink-0" /> : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                  <div><p className="text-sm font-medium">{check.label}</p><p className="text-xs text-muted-foreground">{passed ? "Verificato" : optional ? "Non richiesto dal piano" : "Da completare"}</p></div>
                </div>
              );
            })}
          </div>
          <Button disabled={!readiness.ready}><Bot className="w-4 h-4 mr-2" />{readiness.ready ? "Abilita produzione" : "Produzione bloccata"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="w-5 h-5 text-primary" /> Provider</CardTitle><CardDescription>Responsabilità e requisiti senza credenziali nel browser.</CardDescription></CardHeader>
        <CardContent className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {providerArchitecture.map((provider) => <div key={provider.code} className="rounded-xl border border-border p-4"><p className="font-semibold">{provider.name}</p><p className="text-sm text-muted-foreground mt-2">{provider.role}</p><p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">{provider.requirement}</p></div>)}
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end"><Button size="lg" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salva configurazione</Button></div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-muted/60 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold mt-1">{value}</p></div>;
}
