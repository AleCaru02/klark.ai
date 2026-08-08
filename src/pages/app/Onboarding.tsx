import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Settings,
  ShieldAlert,
  Sparkles,
  Target,
  UserCheck,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fetchIntegrationStatus, type IntegrationStatus } from "@/hooks/useIntegrationStatus";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const steps = [
  { id: 1, title: "Profilo", description: "Contesto dell'attività", icon: Building2 },
  { id: 2, title: "Obiettivi", description: "Risultati e volumi", icon: Target },
  { id: 3, title: "Assistente", description: "Voce e comunicazione", icon: Volume2 },
  { id: 4, title: "Escalation", description: "Limiti e passaggio umano", icon: ShieldAlert },
  { id: 5, title: "Integrazioni", description: "Provider e dipendenze", icon: Settings },
  { id: 6, title: "Go-live", description: "Criteri di accettazione", icon: CheckCircle2 },
] as const;

const professions = [
  "Avvocato",
  "Commercialista",
  "Medico",
  "Dentista",
  "Fisioterapista",
  "Psicologo",
  "Architetto",
  "Ingegnere",
  "Notaio",
  "Consulente del lavoro",
  "Agenzia immobiliare",
  "Centro estetico",
  "Property manager",
  "Altro",
];

const voiceOptions = [
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", description: "Professionale e misurata" },
  { id: "8KInRSd4DtD5L5gK7itu", name: "Giusy", description: "Calda e accogliente" },
  { id: "4YsN90HrCPrOCmBglwMA", name: "Marco", description: "Chiara e professionale" },
  { id: "MTgv1KRJpUnc34UMGTHK", name: "Luca", description: "Calma e rassicurante" },
];

type Formality = "lei" | "tu";
type AppointmentMode = "none" | "request" | "direct";
type WhatsAppMode = "none" | "confirmations" | "followup";
type ReviewFrequency = "weekly" | "monthly" | "quarterly";
type PromptConfiguration = Record<string, unknown>;

const emptyIntegrationStatus: IntegrationStatus = {
  tenant_id: null,
  google: { connected: false },
  facebook: { connected: false },
  whatsapp: { connected: false },
};

function readString(source: PromptConfiguration, key: string, fallback = ""): string {
  const value = source[key];
  return typeof value === "string" ? value : fallback;
}

function isValidOptionalE164(value: string): boolean {
  const normalized = value.trim();
  return !normalized || /^\+[1-9]\d{7,14}$/.test(normalized);
}

function addDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

export default function Onboarding() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [highestStepReached, setHighestStepReached] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isRefreshingIntegrations, setIsRefreshingIntegrations] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [studioName, setStudioName] = useState("");
  const [profession, setProfession] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");

  const [primaryGoal, setPrimaryGoal] = useState("");
  const [successMetric, setSuccessMetric] = useState("");
  const [expectedVolume, setExpectedVolume] = useState("");
  const [mainUseCases, setMainUseCases] = useState("");
  const [appointmentMode, setAppointmentMode] = useState<AppointmentMode>("none");
  const [whatsappMode, setWhatsappMode] = useState<WhatsAppMode>("none");

  const [selectedVoice, setSelectedVoice] = useState(voiceOptions[0].id);
  const [formality, setFormality] = useState<Formality>("lei");
  const [greetingText, setGreetingText] = useState("");
  const [toneNotes, setToneNotes] = useState("");
  const [supportedLanguages, setSupportedLanguages] = useState("Italiano");

  const [businessHours, setBusinessHours] = useState("");
  const [handoffContact, setHandoffContact] = useState("");
  const [handoffPhone, setHandoffPhone] = useState("");
  const [handoffRules, setHandoffRules] = useState("");
  const [criticalTopics, setCriticalTopics] = useState("");
  const [forbiddenActions, setForbiddenActions] = useState("");
  const [urgentKeywords, setUrgentKeywords] = useState("");

  const [reviewFrequency, setReviewFrequency] = useState<ReviewFrequency>("monthly");
  const [reviewOwner, setReviewOwner] = useState("");
  const [integrationsReviewed, setIntegrationsReviewed] = useState(false);
  const [onboardingReviewed, setOnboardingReviewed] = useState(false);

  const [promptConfiguration, setPromptConfiguration] = useState<PromptConfiguration>({});
  const [voiceNumberAssigned, setVoiceNumberAssigned] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>(emptyIntegrationStatus);

  const profileComplete = Boolean(studioName.trim() && profession);
  const objectivesComplete = Boolean(primaryGoal && successMetric.trim() && expectedVolume);
  const assistantComplete = Boolean(selectedVoice && formality && greetingText.trim());
  const handoffComplete = Boolean(
    businessHours.trim() &&
      handoffContact.trim() &&
      handoffRules.trim() &&
      forbiddenActions.trim() &&
      isValidOptionalE164(handoffPhone),
  );
  const googleConnected = integrationStatus.google.connected;
  const whatsappConnected = integrationStatus.whatsapp.connected;
  const testCenterReady = profileComplete && objectivesComplete && assistantComplete && handoffComplete;

  const liveBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!testCenterReady) blockers.push("Configurazione operativa obbligatoria incompleta");
    if (!voiceNumberAssigned) blockers.push("Numero telefonico non assegnato");
    if (appointmentMode === "direct" && !googleConnected) blockers.push("Google Calendar richiesto ma non collegato");
    if (whatsappMode !== "none" && !whatsappConnected) blockers.push("WhatsApp richiesto ma non collegato");
    return blockers;
  }, [appointmentMode, googleConnected, testCenterReady, voiceNumberAssigned, whatsappConnected, whatsappMode]);

  const checks = useMemo(
    () => [
      { label: "Profilo attività", passed: profileComplete, required: true },
      { label: "Obiettivo e metrica di successo", passed: objectivesComplete, required: true },
      { label: "Voce, formalità e saluto", passed: assistantComplete, required: true },
      { label: "Passaggio umano e azioni vietate", passed: handoffComplete, required: true },
      {
        label: "Google Calendar",
        passed: googleConnected,
        required: appointmentMode === "direct",
      },
      { label: "Numero telefonico", passed: voiceNumberAssigned, required: true },
      {
        label: "WhatsApp Business",
        passed: whatsappConnected,
        required: whatsappMode !== "none",
      },
      { label: "Integrazioni riesaminate", passed: integrationsReviewed, required: true },
    ],
    [
      appointmentMode,
      assistantComplete,
      googleConnected,
      handoffComplete,
      integrationsReviewed,
      objectivesComplete,
      profileComplete,
      voiceNumberAssigned,
      whatsappConnected,
      whatsappMode,
    ],
  );

  const completedSections = [
    profileComplete,
    objectivesComplete,
    assistantComplete,
    handoffComplete,
    integrationsReviewed,
    onboardingReviewed,
  ].filter(Boolean).length;
  const progress = Math.round((completedSections / steps.length) * 100);

  const loadConfiguration = async () => {
    if (!tenantId) {
      setLoadError("L'account non è associato a un'organizzazione.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const [settingsResult, tenantResult, statusResult] = await Promise.all([
        supabase
          .from("settings")
          .select("voice_pack_id,formality,voice_number,ai_prompt_json")
          .eq("tenant_id", tenantId)
          .maybeSingle(),
        supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
        fetchIntegrationStatus(),
      ]);

      if (settingsResult.error) throw settingsResult.error;
      if (tenantResult.error) throw tenantResult.error;
      if (!settingsResult.data) throw new Error("Configurazione tenant non inizializzata dall'amministratore.");

      const settings = settingsResult.data;
      const prompt = (settings.ai_prompt_json ?? {}) as PromptConfiguration;
      setPromptConfiguration(prompt);

      setStudioName(readString(prompt, "studio_name", tenantResult.data?.name ?? ""));
      setProfession(readString(prompt, "profession"));
      setAddress(readString(prompt, "address"));
      setWebsite(readString(prompt, "website"));

      setPrimaryGoal(readString(prompt, "primary_goal"));
      setSuccessMetric(readString(prompt, "success_metric"));
      setExpectedVolume(readString(prompt, "expected_volume"));
      setMainUseCases(readString(prompt, "main_use_cases"));
      const storedAppointmentMode = readString(prompt, "appointment_mode", "none");
      if (["none", "request", "direct"].includes(storedAppointmentMode)) {
        setAppointmentMode(storedAppointmentMode as AppointmentMode);
      }
      const storedWhatsappMode = readString(prompt, "whatsapp_mode", "none");
      if (["none", "confirmations", "followup"].includes(storedWhatsappMode)) {
        setWhatsappMode(storedWhatsappMode as WhatsAppMode);
      }

      setGreetingText(readString(prompt, "greeting"));
      setToneNotes(readString(prompt, "tone_notes"));
      setSupportedLanguages(readString(prompt, "supported_languages", "Italiano"));

      setBusinessHours(readString(prompt, "business_hours"));
      setHandoffContact(readString(prompt, "handoff_contact"));
      setHandoffPhone(readString(prompt, "handoff_phone_e164"));
      setHandoffRules(readString(prompt, "handoff_rules"));
      setCriticalTopics(readString(prompt, "critical_topics"));
      setForbiddenActions(readString(prompt, "forbidden_actions"));
      setUrgentKeywords(readString(prompt, "urgent_keywords"));

      const storedReviewFrequency = readString(prompt, "review_frequency", "monthly");
      if (["weekly", "monthly", "quarterly"].includes(storedReviewFrequency)) {
        setReviewFrequency(storedReviewFrequency as ReviewFrequency);
      }
      setReviewOwner(readString(prompt, "review_owner"));
      setIntegrationsReviewed(Boolean(prompt.integrations_reviewed_at));
      setOnboardingReviewed(Boolean(prompt.onboarding_reviewed_at));

      if (settings.voice_pack_id) setSelectedVoice(settings.voice_pack_id);
      if (settings.formality === "lei" || settings.formality === "tu") setFormality(settings.formality);
      setVoiceNumberAssigned(Boolean(settings.voice_number));
      setIntegrationStatus(statusResult);

      const storedStep = Number(prompt.onboarding_step ?? 1);
      const safeStep = Number.isInteger(storedStep) ? Math.min(steps.length, Math.max(1, storedStep)) : 1;
      setHighestStepReached(prompt.onboarding_reviewed_at ? steps.length : safeStep);
    } catch (error) {
      console.error("Unable to load onboarding configuration");
      setLoadError(error instanceof Error ? error.message : "Configurazione non disponibile.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadConfiguration();
  }, [tenantId]);

  const persistPrompt = async (
    updates: PromptConfiguration,
    successMessage: string,
    nextStep?: number,
  ): Promise<boolean> => {
    if (!tenantId) return false;
    const now = new Date().toISOString();
    const nextPrompt = {
      ...promptConfiguration,
      ...updates,
      service_flow_version: 2,
      onboarding_updated_at: now,
      ...(nextStep ? { onboarding_step: nextStep } : {}),
    };

    const result = await supabase
      .from("settings")
      .update({ ai_prompt_json: nextPrompt })
      .eq("tenant_id", tenantId)
      .select("tenant_id")
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error("Configurazione tenant non trovata.");

    setPromptConfiguration(nextPrompt);
    toast.success(successMessage);
    if (nextStep) {
      setCurrentStep(nextStep);
      setHighestStepReached((highest) => Math.max(highest, nextStep));
    }
    return true;
  };

  const saveProfile = async () => {
    if (!tenantId || !profileComplete) {
      toast.error("Inserisci nome attività e settore.");
      return;
    }
    setIsSaving(true);
    try {
      const tenantResult = await supabase
        .from("tenants")
        .update({ name: studioName.trim() })
        .eq("id", tenantId)
        .select("id")
        .maybeSingle();
      if (tenantResult.error) throw tenantResult.error;
      if (!tenantResult.data) throw new Error("Organizzazione non trovata.");

      await persistPrompt(
        {
          studio_name: studioName.trim(),
          profession,
          address: address.trim(),
          website: website.trim(),
          profile_reviewed_at: new Date().toISOString(),
        },
        "Profilo salvato",
        2,
      );
    } catch {
      toast.error("Profilo non salvato. Controlla i dati e riprova.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveObjectives = async () => {
    if (!objectivesComplete) {
      toast.error("Definisci obiettivo, metrica e volume atteso.");
      return;
    }
    setIsSaving(true);
    try {
      await persistPrompt(
        {
          primary_goal: primaryGoal,
          success_metric: successMetric.trim(),
          expected_volume: expectedVolume,
          main_use_cases: mainUseCases.trim(),
          appointment_mode: appointmentMode,
          whatsapp_mode: whatsappMode,
          objectives_reviewed_at: new Date().toISOString(),
        },
        "Obiettivi salvati",
        3,
      );
    } catch {
      toast.error("Obiettivi non salvati.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveAssistant = async () => {
    if (!tenantId || !assistantComplete) {
      toast.error("Seleziona voce, formalità e testo di apertura.");
      return;
    }
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const nextPrompt = {
        ...promptConfiguration,
        greeting: greetingText.trim(),
        tone_notes: toneNotes.trim(),
        supported_languages: supportedLanguages.trim(),
        assistant_reviewed_at: now,
        service_flow_version: 2,
        onboarding_updated_at: now,
        onboarding_step: 4,
      };
      const result = await supabase
        .from("settings")
        .update({ voice_pack_id: selectedVoice, formality, ai_prompt_json: nextPrompt })
        .eq("tenant_id", tenantId)
        .select("tenant_id")
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("Configurazione tenant non trovata.");
      setPromptConfiguration(nextPrompt);
      toast.success("Assistente salvato");
      setCurrentStep(4);
      setHighestStepReached((highest) => Math.max(highest, 4));
    } catch {
      toast.error("Impostazioni dell'assistente non salvate.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveHandoff = async () => {
    if (!handoffComplete) {
      toast.error("Definisci orari, referente, regole di passaggio e azioni vietate.");
      return;
    }
    setIsSaving(true);
    try {
      await persistPrompt(
        {
          business_hours: businessHours.trim(),
          handoff_contact: handoffContact.trim(),
          handoff_phone_e164: handoffPhone.trim(),
          handoff_rules: handoffRules.trim(),
          critical_topics: criticalTopics.trim(),
          forbidden_actions: forbiddenActions.trim(),
          urgent_keywords: urgentKeywords.trim(),
          handoff_reviewed_at: new Date().toISOString(),
        },
        "Regole di escalation salvate",
        5,
      );
    } catch {
      toast.error("Regole di escalation non salvate.");
    } finally {
      setIsSaving(false);
    }
  };

  const refreshIntegrations = async () => {
    setIsRefreshingIntegrations(true);
    try {
      const status = await fetchIntegrationStatus();
      setIntegrationStatus(status);
      toast.success("Stato integrazioni aggiornato");
    } catch {
      toast.error("Stato integrazioni non disponibile.");
    } finally {
      setIsRefreshingIntegrations(false);
    }
  };

  const connectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-auth-start", { body: {} });
      if (error) throw error;
      const authUrl = typeof data?.auth_url === "string" ? data.auth_url : null;
      if (!authUrl || !authUrl.startsWith("https://accounts.google.com/")) {
        throw new Error("URL OAuth non valida.");
      }
      window.location.assign(authUrl);
    } catch {
      toast.error("Impossibile avviare il collegamento Google.");
      setIsConnectingGoogle(false);
    }
  };

  const saveIntegrationReview = async () => {
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      await persistPrompt(
        {
          integrations_reviewed_at: now,
          integration_snapshot: {
            google_connected: googleConnected,
            whatsapp_connected: whatsappConnected,
            voice_number_assigned: voiceNumberAssigned,
          },
        },
        "Stato integrazioni registrato",
        6,
      );
      setIntegrationsReviewed(true);
    } catch {
      toast.error("Revisione integrazioni non salvata.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveReview = async () => {
    if (!tenantId || !testCenterReady || !integrationsReviewed) {
      toast.error("Completa prima configurazione operativa e revisione delle integrazioni.");
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const reviewedAt = now.toISOString();
      const nextPrompt = {
        ...promptConfiguration,
        review_frequency: reviewFrequency,
        review_owner: reviewOwner.trim(),
        onboarding_reviewed_at: reviewedAt,
        post_launch_review_at: addDays(now, 30),
        launch_readiness: {
          test_center_ready: true,
          live_ready: liveBlockers.length === 0,
          live_blockers: liveBlockers,
          checked_at: reviewedAt,
        },
        service_flow_version: 2,
        onboarding_step: 6,
        onboarding_updated_at: reviewedAt,
      };
      const result = await supabase
        .from("settings")
        .update({ ai_prompt_json: nextPrompt })
        .eq("tenant_id", tenantId)
        .select("tenant_id")
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("Configurazione tenant non trovata.");

      setPromptConfiguration(nextPrompt);
      setOnboardingReviewed(true);
      toast.success(
        liveBlockers.length === 0
          ? "Configurazione pronta per il Test Center. Il live resta subordinato al collaudo."
          : "Configurazione pronta per i test. I blocchi live restano visibili.",
      );
      navigate("/app/tests");
    } catch {
      toast.error("Verifica finale non salvata.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[420px] flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Caricamento configurazione</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="max-w-xl mx-auto border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" aria-hidden="true" />
            Onboarding non disponibile
          </CardTitle>
          <CardDescription>{loadError}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => void loadConfiguration()}>
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            Riprova
          </Button>
          <Button variant="outline" onClick={() => navigate("/app")}>Torna alla dashboard</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center">
        <Badge variant="secondary" className="mb-3">Service flow v2</Badge>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Configurazione operativa assistita</h1>
        <p className="text-muted-foreground mb-5 max-w-3xl mx-auto">
          Il servizio viene portato ai test soltanto dopo aver definito obiettivi, limiti, responsabilità e dipendenze. Il completamento dell'onboarding non equivale alla messa online.
        </p>
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-muted-foreground">Completezza operativa</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" aria-label={`Completezza onboarding ${progress}%`} />
        </div>
      </div>

      <nav className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2" aria-label="Passaggi configurazione">
        {steps.map((step) => {
          const Icon = step.icon;
          const available = step.id <= highestStepReached;
          return (
            <button
              key={step.id}
              type="button"
              disabled={!available}
              onClick={() => setCurrentStep(step.id)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                currentStep === step.id ? "border-primary bg-primary/5" : "hover:bg-muted/50",
              )}
              aria-current={currentStep === step.id ? "step" : undefined}
            >
              <Icon className="w-5 h-5 mb-2 text-primary" aria-hidden="true" />
              <span className="block text-sm font-medium">{step.title}</span>
              <span className="block text-xs text-muted-foreground mt-1">{step.description}</span>
            </button>
          );
        })}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep - 1].title}</CardTitle>
          <CardDescription>{steps[currentStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep === 1 && (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="studio-name">Nome attività *</Label>
                  <Input id="studio-name" value={studioName} onChange={(event) => setStudioName(event.target.value)} maxLength={160} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profession">Settore *</Label>
                  <Select value={profession} onValueChange={setProfession}>
                    <SelectTrigger id="profession"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      {professions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Sede o area servita</Label>
                  <Input id="address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={240} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Sito web</Label>
                  <Input id="website" type="url" value={website} onChange={(event) => setWebsite(event.target.value)} maxLength={300} placeholder="https://" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => void saveProfile()} disabled={isSaving || !profileComplete}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Salva e definisci gli obiettivi
                  <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                </Button>
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary-goal">Obiettivo principale *</Label>
                  <Select value={primaryGoal} onValueChange={setPrimaryGoal}>
                    <SelectTrigger id="primary-goal"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="appointments">Aumentare appuntamenti gestiti</SelectItem>
                      <SelectItem value="response">Ridurre richieste senza risposta</SelectItem>
                      <SelectItem value="qualification">Qualificare lead prima del contatto umano</SelectItem>
                      <SelectItem value="support">Ridurre lavoro sulle richieste ricorrenti</SelectItem>
                      <SelectItem value="coverage">Coprire chiusure e picchi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expected-volume">Volume atteso *</Label>
                  <Select value={expectedVolume} onValueChange={setExpectedVolume}>
                    <SelectTrigger id="expected-volume"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-20">Fino a 20 richieste a settimana</SelectItem>
                      <SelectItem value="21-100">Da 21 a 100 richieste a settimana</SelectItem>
                      <SelectItem value="100+">Oltre 100 richieste a settimana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="success-metric">Metrica di successo *</Label>
                <Input
                  id="success-metric"
                  value={successMetric}
                  onChange={(event) => setSuccessMetric(event.target.value)}
                  maxLength={240}
                  placeholder="Esempio: richieste senza risposta sotto il 5%"
                />
                <p className="text-xs text-muted-foreground">Usa una misura verificabile, non formule generiche come “migliorare il servizio”.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="main-use-cases">Richieste e scenari principali</Label>
                <Textarea
                  id="main-use-cases"
                  value={mainUseCases}
                  onChange={(event) => setMainUseCases(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Elenca le richieste più frequenti e l'esito corretto atteso."
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="appointment-mode">Gestione appuntamenti</Label>
                  <Select value={appointmentMode} onValueChange={(value) => setAppointmentMode(value as AppointmentMode)}>
                    <SelectTrigger id="appointment-mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non necessaria</SelectItem>
                      <SelectItem value="request">Raccoglie la richiesta, conferma una persona</SelectItem>
                      <SelectItem value="direct">Prenota direttamente sul calendario</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-mode">Uso di WhatsApp</Label>
                  <Select value={whatsappMode} onValueChange={(value) => setWhatsappMode(value as WhatsAppMode)}>
                    <SelectTrigger id="whatsapp-mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non necessario</SelectItem>
                      <SelectItem value="confirmations">Conferme e promemoria</SelectItem>
                      <SelectItem value="followup">Conferme e follow-up avanzato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={() => setCurrentStep(1)}><ArrowLeft className="w-4 h-4 mr-2" />Indietro</Button>
                <Button onClick={() => void saveObjectives()} disabled={isSaving || !objectivesComplete}>
                  Salva obiettivi<ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              <div>
                <Label className="mb-3 block">Voce *</Label>
                <div className="grid sm:grid-cols-2 gap-3">
                  {voiceOptions.map((voice) => (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => setSelectedVoice(voice.id)}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-colors",
                        selectedVoice === voice.id ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                      )}
                      aria-pressed={selectedVoice === voice.id}
                    >
                      <span className="font-semibold block">{voice.name}</span>
                      <span className="text-sm text-muted-foreground block mt-1">{voice.description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="formality">Forma di cortesia *</Label>
                  <Select value={formality} onValueChange={(value) => setFormality(value as Formality)}>
                    <SelectTrigger id="formality"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lei">Usa il Lei</SelectItem>
                      <SelectItem value="tu">Usa il tu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="languages">Lingue supportate</Label>
                  <Input id="languages" value={supportedLanguages} onChange={(event) => setSupportedLanguages(event.target.value)} maxLength={160} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="greeting">Testo di apertura *</Label>
                <Textarea id="greeting" value={greetingText} onChange={(event) => setGreetingText(event.target.value)} maxLength={500} rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone-notes">Indicazioni su tono e linguaggio</Label>
                <Textarea
                  id="tone-notes"
                  value={toneNotes}
                  onChange={(event) => setToneNotes(event.target.value)}
                  maxLength={1200}
                  rows={3}
                  placeholder="Esempio: diretto, senza tecnicismi, non promettere disponibilità prima della verifica."
                />
              </div>
              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={() => setCurrentStep(2)}><ArrowLeft className="w-4 h-4 mr-2" />Indietro</Button>
                <Button onClick={() => void saveAssistant()} disabled={isSaving || !assistantComplete}>
                  Salva assistente<ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </>
          )}

          {currentStep === 4 && (
            <>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                L'assistente non deve improvvisare. Qui vengono definite le condizioni in cui deve fermarsi, raccogliere contesto e coinvolgere una persona.
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-hours">Orari e copertura *</Label>
                  <Input id="business-hours" value={businessHours} onChange={(event) => setBusinessHours(event.target.value)} maxLength={300} placeholder="Lun-Ven 09:00-18:00; reperibilità..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="handoff-contact">Referente umano o reparto *</Label>
                  <Input id="handoff-contact" value={handoffContact} onChange={(event) => setHandoffContact(event.target.value)} maxLength={300} placeholder="Ruolo, canale e ordine di escalation" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="handoff-phone">Numero per trasferimento diretto (opzionale)</Label>
                <Input
                  id="handoff-phone"
                  type="tel"
                  inputMode="tel"
                  value={handoffPhone}
                  onChange={(event) => setHandoffPhone(event.target.value)}
                  maxLength={16}
                  placeholder="+393331234567"
                  aria-invalid={!isValidOptionalE164(handoffPhone)}
                />
                <p className="text-xs text-muted-foreground">
                  Solo questo numero preconfigurato può essere composto dal flusso Voice. Lascialo vuoto se vuoi soltanto raccogliere una richiesta di richiamo.
                </p>
                {!isValidOptionalE164(handoffPhone) ? (
                  <p className="text-xs text-destructive">Usa il formato internazionale E.164, ad esempio +393331234567.</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="handoff-rules">Quando passare la richiesta a una persona *</Label>
                <Textarea id="handoff-rules" value={handoffRules} onChange={(event) => setHandoffRules(event.target.value)} maxLength={2500} rows={4} placeholder="Richiesta esplicita, risposta non disponibile, due tentativi falliti, reclamo, urgenza..." />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="critical-topics">Argomenti critici</Label>
                  <Textarea id="critical-topics" value={criticalTopics} onChange={(event) => setCriticalTopics(event.target.value)} maxLength={1500} rows={3} placeholder="Pagamenti, reclami, dati sanitari, richieste legali..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forbidden-actions">Azioni vietate *</Label>
                  <Textarea id="forbidden-actions" value={forbiddenActions} onChange={(event) => setForbiddenActions(event.target.value)} maxLength={1500} rows={3} placeholder="Non concedere sconti, non confermare diagnosi, non modificare dati senza verifica..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="urgent-keywords">Parole o segnali di urgenza</Label>
                <Input id="urgent-keywords" value={urgentKeywords} onChange={(event) => setUrgentKeywords(event.target.value)} maxLength={500} placeholder="urgente, incidente, perdita, dolore forte..." />
              </div>
              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={() => setCurrentStep(3)}><ArrowLeft className="w-4 h-4 mr-2" />Indietro</Button>
                <Button onClick={() => void saveHandoff()} disabled={isSaving || !handoffComplete}>
                  Salva escalation<ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </>
          )}

          {currentStep === 5 && (
            <>
              <div className="grid md:grid-cols-3 gap-4">
                <Card className={cn(appointmentMode === "direct" && !googleConnected && "border-destructive/40")}>
                  <CardHeader className="pb-3">
                    <Calendar className="w-6 h-6 text-primary mb-2" />
                    <CardTitle className="text-base">Google Calendar</CardTitle>
                    <CardDescription>{googleConnected ? "Collegato" : appointmentMode === "direct" ? "Obbligatorio per la prenotazione diretta" : "Non collegato"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {googleConnected ? (
                      <Badge><Check className="w-3 h-3 mr-1" />Attivo</Badge>
                    ) : (
                      <Button size="sm" onClick={() => void connectGoogle()} disabled={isConnectingGoogle}>
                        {isConnectingGoogle ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Collega
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className={cn(!voiceNumberAssigned && "border-destructive/40")}>
                  <CardHeader className="pb-3">
                    <Phone className="w-6 h-6 text-primary mb-2" />
                    <CardTitle className="text-base">Numero telefonico</CardTitle>
                    <CardDescription>{voiceNumberAssigned ? "Numero assegnato" : "Assegnazione amministrativa necessaria"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={voiceNumberAssigned ? "default" : "secondary"}>
                      {voiceNumberAssigned ? "Attivo" : "In attesa"}
                    </Badge>
                  </CardContent>
                </Card>

                <Card className={cn(whatsappMode !== "none" && !whatsappConnected && "border-destructive/40")}>
                  <CardHeader className="pb-3">
                    <MessageCircle className="w-6 h-6 text-primary mb-2" />
                    <CardTitle className="text-base">WhatsApp Business</CardTitle>
                    <CardDescription>{whatsappConnected ? "Collegato" : whatsappMode !== "none" ? "Richiesto dal flusso" : "Non richiesto"}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Badge variant={whatsappConnected ? "default" : "secondary"}>{whatsappConnected ? "Attivo" : "Non collegato"}</Badge>
                    {!whatsappConnected && whatsappMode !== "none" ? (
                      <Button size="sm" variant="outline" onClick={() => navigate("/app/integrations")}>Configura</Button>
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                La revisione registra uno snapshot dello stato attuale. Non considera “attiva” un'integrazione soltanto perché è stata selezionata nel piano.
              </div>

              <div className="flex flex-wrap justify-between gap-3">
                <Button variant="outline" onClick={() => setCurrentStep(4)}><ArrowLeft className="w-4 h-4 mr-2" />Indietro</Button>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void refreshIntegrations()} disabled={isRefreshingIntegrations}>
                    <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshingIntegrations && "animate-spin")} />Aggiorna stato
                  </Button>
                  <Button onClick={() => void saveIntegrationReview()} disabled={isSaving}>
                    Registra revisione<ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {currentStep === 6 && (
            <>
              <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" />Controlli di accettazione</h3>
                  {checks.map((check) => (
                    <div key={check.label} className="rounded-xl border p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{check.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{check.required ? "Obbligatorio per il live" : "Opzionale per il flusso scelto"}</p>
                      </div>
                      <Badge variant={check.passed ? "default" : check.required ? "destructive" : "secondary"}>
                        {check.passed ? "Verificato" : check.required ? "Bloccante" : "Non attivo"}
                      </Badge>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <Card className={cn(liveBlockers.length > 0 ? "border-destructive/40" : "border-primary/40")}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        {liveBlockers.length > 0 ? <AlertCircle className="w-5 h-5 text-destructive" /> : <CheckCircle2 className="w-5 h-5 text-primary" />}
                        Stato messa online
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {liveBlockers.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                          {liveBlockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}
                        </ul>
                      ) : (
                        <p className="text-sm">Nessun blocco di configurazione rilevato. Il live richiede comunque il superamento del Test Center.</p>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <Label htmlFor="review-frequency">Frequenza revisione</Label>
                    <Select value={reviewFrequency} onValueChange={(value) => setReviewFrequency(value as ReviewFrequency)}>
                      <SelectTrigger id="review-frequency"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Settimanale nella fase iniziale</SelectItem>
                        <SelectItem value="monthly">Mensile</SelectItem>
                        <SelectItem value="quarterly">Trimestrale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="review-owner">Responsabile della revisione</Label>
                    <Input id="review-owner" value={reviewOwner} onChange={(event) => setReviewOwner(event.target.value)} maxLength={240} placeholder="Nome o ruolo" />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <p className="font-medium flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Revisione post-lancio</p>
                <p className="text-muted-foreground mt-1">Al salvataggio viene registrata una revisione prevista a 30 giorni per controllare richieste irrisolte, passaggi umani, errori e aggiornamenti necessari.</p>
              </div>

              <div className="flex flex-wrap justify-between gap-3">
                <Button variant="outline" onClick={() => setCurrentStep(5)}><ArrowLeft className="w-4 h-4 mr-2" />Indietro</Button>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => navigate("/app")}>Salva e torna dopo</Button>
                  <Button onClick={() => void saveReview()} disabled={isSaving || !testCenterReady || !integrationsReviewed}>
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}
                    Registra e apri il Test Center
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
