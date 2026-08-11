import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Clipboard,
  Code2,
  Globe2,
  KeyRound,
  Loader2,
  MessageSquareText,
  Play,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
} from "lucide-react";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, supabaseFunctionsBase } from "@/integrations/supabase/client";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { toast } from "sonner";

type ChatbotConfig = {
  id: string;
  tenant_id: string;
  public_key: string;
  is_enabled: boolean;
  display_name: string;
  welcome_message: string;
  allowed_origins: string[];
  accent_color: string;
  position: "left" | "right";
  collect_name: boolean;
  collect_email: boolean;
  collect_phone: boolean;
  require_consent: boolean;
  consent_text: string;
  create_crm_contact: boolean;
  calendar_enabled: boolean;
  escalation_enabled: boolean;
  human_label: string;
  max_messages_per_session: number;
  rate_limit_per_minute: number;
  monthly_message_limit: number;
  retention_days: number;
};

const defaultConfig = (tenantId: string, monthlyLimit: number): Omit<ChatbotConfig, "id" | "public_key"> => ({
  tenant_id: tenantId,
  is_enabled: false,
  display_name: "Assistente",
  welcome_message: "Ciao. Come posso aiutarti?",
  allowed_origins: [],
  accent_color: "#2563eb",
  position: "right",
  collect_name: true,
  collect_email: true,
  collect_phone: false,
  require_consent: true,
  consent_text: "Accetto che i dati inseriti siano utilizzati per rispondere alla richiesta e, se necessario, essere ricontattato.",
  create_crm_contact: true,
  calendar_enabled: false,
  escalation_enabled: true,
  human_label: "Parla con una persona",
  max_messages_per_session: 24,
  rate_limit_per_minute: 8,
  monthly_message_limit: monthlyLimit || 1500,
  retention_days: 90,
});

function parseOrigins(value: string): string[] {
  return Array.from(new Set(value.split(/\r?\n|,/).map((item) => item.trim().replace(/\/$/, "")).filter(Boolean)));
}

function validOrigin(value: string): boolean {
  if (/^https:\/\/\*\.[a-z0-9.-]+(?::\d+)?$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && url.origin === value;
  } catch {
    return false;
  }
}

export default function SiteChatbot() {
  const { membership } = useAuth();
  const { flags } = usePlanFeatures();
  const tenantId = membership?.tenant_id;
  const db = supabase as any;
  const [config, setConfig] = useState<ChatbotConfig | null>(null);
  const [originsText, setOriginsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ sessions: 0, messages: 0, handoffs: 0, monthUsage: 0, approvedSources: 0 });

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [botResult, sessionsResult, messagesResult, handoffResult, usageResult, sourcesResult, auditResult] = await Promise.all([
        db.from("site_chatbots").select("*").eq("tenant_id", tenantId).maybeSingle(),
        db.from("site_chat_sessions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", thirtyDaysAgo),
        db.from("site_chat_messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", thirtyDaysAgo),
        db.from("site_chat_sessions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "handoff_requested").gte("created_at", thirtyDaysAgo),
        db.from("usage_site_chat_daily").select("messages").eq("tenant_id", tenantId).gte("date", monthStart.toISOString().slice(0, 10)),
        db.from("tenant_knowledge").select("id,status").eq("tenant_id", tenantId).eq("status", "completed"),
        db.from("audit_log").select("action,payload_json,created_at").eq("tenant_id", tenantId).in("action", ["knowledge.source_approved", "knowledge.source_revoked", "knowledge.source_expired"]).order("created_at", { ascending: false }).limit(500),
      ]);
      if (botResult.error) throw botResult.error;
      let nextConfig = botResult.data as ChatbotConfig | null;
      if (!nextConfig) {
        const initial = defaultConfig(tenantId, Number(flags.site_chat_monthly_messages || 1500));
        const inserted = await db.from("site_chatbots").insert(initial).select("*").single();
        if (inserted.error) throw inserted.error;
        nextConfig = inserted.data as ChatbotConfig;
      }
      setConfig(nextConfig);
      setOriginsText((nextConfig.allowed_origins || []).join("\n"));

      const latest = new Map<string, { action: string; expiresAt: string | null }>();
      for (const event of auditResult.data || []) {
        const payload = event.payload_json && typeof event.payload_json === "object" ? event.payload_json : {};
        const sourceId = typeof payload.source_id === "string" ? payload.source_id : "";
        if (sourceId && !latest.has(sourceId)) latest.set(sourceId, {
          action: event.action,
          expiresAt: typeof payload.expires_at === "string" ? payload.expires_at : null,
        });
      }
      const approvedSources = (sourcesResult.data || []).filter((source: { id: string }) => {
        const state = latest.get(source.id);
        return state?.action === "knowledge.source_approved" && (!state.expiresAt || Date.parse(state.expiresAt) > Date.now());
      }).length;
      setStats({
        sessions: sessionsResult.count || 0,
        messages: messagesResult.count || 0,
        handoffs: handoffResult.count || 0,
        monthUsage: (usageResult.data || []).reduce((sum: number, row: { messages: number }) => sum + Number(row.messages || 0), 0),
        approvedSources,
      });
    } catch (error) {
      console.error("Unable to load site chatbot", error);
      toast.error("Configurazione chatbot non disponibile.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, flags.site_chat_monthly_messages]);

  useEffect(() => { void load(); }, [load]);

  const origins = useMemo(() => parseOrigins(originsText), [originsText]);
  const invalidOrigins = origins.filter((origin) => !validOrigin(origin));
  const canEnable = origins.length > 0 && invalidOrigins.length === 0 && stats.approvedSources > 0;
  const apiBase = supabaseFunctionsBase;
  const scriptUrl = `${window.location.origin}/clark-chat.js`;
  const embedCode = config ? `<script async src="${scriptUrl}" data-widget-key="${config.public_key}" data-api-base="${apiBase}"></script>` : "";

  const update = <K extends keyof ChatbotConfig>(key: K, value: ChatbotConfig[K]) => {
    setConfig((current) => current ? { ...current, [key]: value } : current);
  };

  const save = async () => {
    if (!config || !tenantId) return;
    if (invalidOrigins.length) {
      toast.error(`Domini non validi: ${invalidOrigins.join(", ")}`);
      return;
    }
    if (config.is_enabled && !canEnable) {
      toast.error("Per attivare il chatbot servono almeno un dominio valido e una fonte approvata.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        display_name: config.display_name.trim().slice(0, 80) || "Assistente",
        welcome_message: config.welcome_message.trim().slice(0, 500),
        allowed_origins: origins,
        accent_color: config.accent_color,
        position: config.position,
        collect_name: config.collect_name,
        collect_email: config.collect_email,
        collect_phone: config.collect_phone,
        require_consent: config.require_consent,
        consent_text: config.consent_text.trim().slice(0, 1000),
        create_crm_contact: config.create_crm_contact,
        calendar_enabled: config.calendar_enabled,
        escalation_enabled: config.escalation_enabled,
        human_label: config.human_label.trim().slice(0, 80) || "Parla con una persona",
        max_messages_per_session: config.max_messages_per_session,
        rate_limit_per_minute: config.rate_limit_per_minute,
        monthly_message_limit: Math.min(config.monthly_message_limit, Number(flags.site_chat_monthly_messages || config.monthly_message_limit)),
        retention_days: config.retention_days,
        is_enabled: config.is_enabled,
      };
      const result = await db.from("site_chatbots").update(payload).eq("id", config.id).eq("tenant_id", tenantId).select("*").single();
      if (result.error) throw result.error;
      setConfig(result.data as ChatbotConfig);
      await db.from("audit_log").insert({
        tenant_id: tenantId,
        actor_user_id: membership?.user_id || null,
        action: "site_chatbot.configuration_updated",
        payload_json: { chatbot_id: config.id, enabled: payload.is_enabled, allowed_origins: origins },
      });
      toast.success("Chatbot aggiornato.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salvataggio non completato.");
    } finally {
      setSaving(false);
    }
  };

  const rotateKey = async () => {
    if (!config || !confirm("La chiave attuale smetterà di funzionare e il chatbot verrà disattivato. Continuare?")) return;
    try {
      const result = await db.rpc("rotate_site_chatbot_key", { p_chatbot_id: config.id });
      if (result.error) throw result.error;
      update("public_key", result.data as string);
      update("is_enabled", false);
      toast.success("Chiave ruotata. Aggiorna il codice sul sito e riattiva il chatbot.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rotazione non completata.");
    }
  };

  const copyEmbed = async () => {
    await navigator.clipboard.writeText(embedCode);
    toast.success("Codice copiato.");
  };

  const testWidget = () => {
    if (!config?.is_enabled) {
      toast.error("Salva e attiva il chatbot prima del test.");
      return;
    }
    const existing = document.querySelector(`script[data-clark-test="${config.public_key}"]`);
    if (existing) {
      toast.info("Il widget di prova è già caricato in questa pagina.");
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.src = scriptUrl;
    script.dataset.widgetKey = config.public_key;
    script.dataset.apiBase = apiBase;
    script.dataset.clarkTest = config.public_key;
    document.body.appendChild(script);
    toast.success("Widget di prova caricato in basso nella pagina.");
  };

  if (loading || !config) {
    return <div className="min-h-[420px] flex items-center justify-center" role="status"><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="sr-only">Caricamento chatbot</span></div>;
  }

  return (
    <FeatureGate feature="site_chat_enabled" title="Chatbot sito" description="Il chatbot con knowledge base, CRM ed escalation è incluso dal piano Growth.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="secondary" className="mb-3">Isolato per organizzazione</Badge>
            <h1 className="text-2xl font-bold">Chatbot del sito</h1>
            <p className="text-muted-foreground max-w-3xl mt-1">Ogni cliente usa la propria knowledge base, i propri domini, CRM, calendario e regole. Il widget pubblico non riceve tenant ID, token OAuth o credenziali.</p>
          </div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => void load()}><RefreshCw className="w-4 h-4 mr-2" />Aggiorna</Button><Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salva</Button></div>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <Metric icon={Users} label="Sessioni 30 giorni" value={stats.sessions} />
          <Metric icon={MessageSquareText} label="Messaggi 30 giorni" value={stats.messages} />
          <Metric icon={Bot} label="Uso mese" value={`${stats.monthUsage}/${config.monthly_message_limit}`} />
          <Metric icon={ShieldCheck} label="Fonti approvate" value={stats.approvedSources} />
          <Metric icon={Users} label="Passaggi umani" value={stats.handoffs} />
        </div>

        <Card className={config.is_enabled ? "border-green-500/40" : undefined}>
          <CardHeader><div className="flex items-center justify-between gap-4"><div><CardTitle>Stato del widget</CardTitle><CardDescription>La pubblicazione resta bloccata senza dominio autorizzato e knowledge base approvata.</CardDescription></div><Switch checked={config.is_enabled} onCheckedChange={(value) => update("is_enabled", value)} disabled={!canEnable && !config.is_enabled} /></div></CardHeader>
          <CardContent>{config.is_enabled ? <div className="flex items-center gap-2 text-green-700"><CheckCircle2 className="w-5 h-5" />Attivo sui domini autorizzati</div> : <p className="text-sm text-muted-foreground">Disattivato. {stats.approvedSources === 0 ? "Approva almeno una fonte nella Governance conoscenza. " : ""}{origins.length === 0 ? "Inserisci almeno un dominio." : ""}</p>}</CardContent>
        </Card>

        <div className="grid xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="w-5 h-5 text-primary" />Aspetto e comportamento</CardTitle><CardDescription>Configurazione mostrata ai visitatori del sito.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Nome assistente"><Input value={config.display_name} onChange={(e) => update("display_name", e.target.value)} maxLength={80} /></Field>
              <Field label="Messaggio iniziale"><Textarea value={config.welcome_message} onChange={(e) => update("welcome_message", e.target.value)} maxLength={500} rows={3} /></Field>
              <div className="grid sm:grid-cols-2 gap-4"><Field label="Colore"><Input type="color" value={config.accent_color} onChange={(e) => update("accent_color", e.target.value)} /></Field><Field label="Posizione"><Select value={config.position} onValueChange={(value) => update("position", value as "left" | "right")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="right">Destra</SelectItem><SelectItem value="left">Sinistra</SelectItem></SelectContent></Select></Field></div>
              <Toggle label="Richiedi nome" checked={config.collect_name} onChange={(value) => update("collect_name", value)} />
              <Toggle label="Richiedi email" checked={config.collect_email} onChange={(value) => update("collect_email", value)} />
              <Toggle label="Richiedi telefono" checked={config.collect_phone} onChange={(value) => update("collect_phone", value)} />
              <Toggle label="Consenso obbligatorio" checked={config.require_consent} onChange={(value) => update("require_consent", value)} />
              {config.require_consent && <Field label="Testo consenso"><Textarea value={config.consent_text} onChange={(e) => update("consent_text", e.target.value)} maxLength={1000} rows={3} /></Field>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" />Sicurezza e azioni</CardTitle><CardDescription>Il chatbot usa solo fonti approvate e crea dati esclusivamente nel tenant corrente.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Domini autorizzati, uno per riga"><Textarea value={originsText} onChange={(e) => setOriginsText(e.target.value)} rows={5} placeholder={"https://azienda.it\nhttps://www.azienda.it\nhttps://*.azienda.it"} /></Field>
              {invalidOrigins.length > 0 && <p className="text-sm text-destructive">Non validi: {invalidOrigins.join(", ")}</p>}
              <Toggle label="Crea contatto e lead nel CRM" checked={config.create_crm_contact} onChange={(value) => update("create_crm_contact", value)} />
              <Toggle label="Raccogli richieste appuntamento" checked={config.calendar_enabled} onChange={(value) => update("calendar_enabled", value)} />
              <Toggle label="Permetti passaggio a una persona" checked={config.escalation_enabled} onChange={(value) => update("escalation_enabled", value)} />
              {config.escalation_enabled && <Field label="Etichetta passaggio umano"><Input value={config.human_label} onChange={(e) => update("human_label", e.target.value)} maxLength={80} /></Field>}
              <div className="grid sm:grid-cols-2 gap-4"><Field label="Messaggi per sessione"><Input type="number" min={1} max={100} value={config.max_messages_per_session} onChange={(e) => update("max_messages_per_session", Number(e.target.value))} /></Field><Field label="Messaggi al minuto"><Input type="number" min={1} max={30} value={config.rate_limit_per_minute} onChange={(e) => update("rate_limit_per_minute", Number(e.target.value))} /></Field></div>
              <div className="grid sm:grid-cols-2 gap-4"><Field label="Limite mensile"><Input type="number" min={50} max={Number(flags.site_chat_monthly_messages || 1500)} value={config.monthly_message_limit} onChange={(e) => update("monthly_message_limit", Number(e.target.value))} /></Field><Field label="Conservazione"><Select value={String(config.retention_days)} onValueChange={(value) => update("retention_days", Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30">30 giorni</SelectItem><SelectItem value="90">90 giorni</SelectItem><SelectItem value="365">365 giorni</SelectItem><SelectItem value="730">730 giorni</SelectItem></SelectContent></Select></Field></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="w-5 h-5 text-primary" />Installazione sul sito</CardTitle><CardDescription>Il codice contiene solo una chiave pubblica revocabile. Nessun segreto viene inserito nella pagina del cliente.</CardDescription></CardHeader>
          <CardContent className="space-y-4"><pre className="overflow-auto rounded-xl bg-slate-950 text-slate-100 p-4 text-xs"><code>{embedCode}</code></pre><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void copyEmbed()}><Clipboard className="w-4 h-4 mr-2" />Copia codice</Button><Button variant="outline" onClick={testWidget}><Play className="w-4 h-4 mr-2" />Testa widget</Button><Button variant="destructive" onClick={() => void rotateKey()}><KeyRound className="w-4 h-4 mr-2" />Ruota chiave</Button></div><p className="text-xs text-muted-foreground">Dopo la rotazione il widget viene disattivato e tutte le sessioni attive sono revocate. Aggiorna il codice incorporato prima di riattivarlo.</p></CardContent>
        </Card>
      </div>
    </FeatureGate>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Globe2; label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Icon className="w-5 h-5 text-primary" /></div><div><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></div></CardContent></Card>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 rounded-lg border p-3"><Label className="cursor-pointer">{label}</Label><Switch checked={checked} onCheckedChange={onChange} /></div>;
}
