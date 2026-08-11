import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Calendar, CheckCircle2, CircleDashed, Facebook, MessageCircle, Phone, ShieldCheck, TestTube2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";

type ReadinessState = "not_configured" | "configured" | "connected" | "verified" | "active" | "error" | "optional" | "checking";

type ReadinessItem = {
  id: string;
  label: string;
  description: string;
  state: ReadinessState;
  icon: typeof Phone;
  required?: boolean;
};

type VoiceSnapshot = {
  onboardingConfigured: boolean;
  numberAssigned: boolean;
  regulatoryApproved: boolean;
  providerVerified: boolean;
  runtimeVerified: boolean;
  enabled: boolean;
};

type OnboardingSnapshot = {
  voice?: VoiceSnapshot;
};

const emptyVoice: VoiceSnapshot = {
  onboardingConfigured: false,
  numberAssigned: false,
  regulatoryApproved: false,
  providerVerified: false,
  runtimeVerified: false,
  enabled: false,
};

function StatusBadge({ state }: { state: ReadinessState }) {
  const labels: Record<ReadinessState, string> = {
    not_configured: "NON CONFIGURATO",
    configured: "CONFIGURATO",
    connected: "COLLEGATO",
    verified: "VERIFICATO",
    active: "ATTIVO",
    error: "ERRORE",
    optional: "OPZIONALE",
    checking: "CONTROLLO",
  };

  if (state === "active" || state === "verified") {
    return <Badge className="gap-1 bg-green-600 hover:bg-green-600"><CheckCircle2 className="w-3 h-3" />{labels[state]}</Badge>;
  }
  if (state === "optional" || state === "configured" || state === "connected") {
    return <Badge variant="secondary" className="gap-1"><CircleDashed className="w-3 h-3" />{labels[state]}</Badge>;
  }
  if (state === "checking") {
    return <Badge variant="outline" className="gap-1"><CircleDashed className="w-3 h-3 animate-spin" />{labels[state]}</Badge>;
  }
  return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />{labels[state]}</Badge>;
}

function voiceState(snapshot: VoiceSnapshot, loading: boolean): ReadinessState {
  if (loading) return "checking";
  if (!snapshot.onboardingConfigured) return "not_configured";
  if (!snapshot.numberAssigned) return "configured";
  if (!snapshot.regulatoryApproved || !snapshot.providerVerified || !snapshot.runtimeVerified) {
    return snapshot.enabled ? "error" : "connected";
  }
  return snapshot.enabled ? "active" : "verified";
}

export function IntegrationStatus() {
  const { membership } = useAuth();
  const { status, loading: integrationsLoading, error: integrationsError } = useIntegrationStatus(Boolean(membership));
  const [voice, setVoice] = useState<VoiceSnapshot>(emptyVoice);
  const [localLoading, setLocalLoading] = useState(true);
  const [localError, setLocalError] = useState(false);

  useEffect(() => {
    if (!membership?.tenant_id) {
      setLocalLoading(false);
      setVoice(emptyVoice);
      return;
    }

    const fetchLocalReadiness = async () => {
      setLocalLoading(true);
      setLocalError(false);
      try {
        const { data, error } = await supabase.functions.invoke<OnboardingSnapshot>("onboarding-config", {
          body: { action: "get" },
        });
        if (error || !data?.voice) throw error ?? new Error("Voice readiness unavailable");
        setVoice(data.voice);
      } catch {
        setLocalError(true);
        setVoice(emptyVoice);
      } finally {
        setLocalLoading(false);
      }
    };

    void fetchLocalReadiness();
  }, [membership?.tenant_id]);

  const loading = integrationsLoading || localLoading;
  const voiceReadiness = voiceState(voice, loading);
  const e2ePassed = voice.runtimeVerified && voice.regulatoryApproved && voice.providerVerified && voice.numberAssigned;

  const items = useMemo<ReadinessItem[]>(() => {
    const integrationState = (connected: boolean, required: boolean): ReadinessState => {
      if (loading) return "checking";
      if (connected) return "connected";
      return required ? "not_configured" : "optional";
    };

    return [
      {
        id: "voice",
        label: "Telefonia Voice",
        description: "Configurazione tenant → numero → regulatory/provider → E2E reale → abilitazione. Il collegamento Twilio da solo non rende Voice attiva.",
        state: localError ? "error" : voiceReadiness,
        icon: Phone,
        required: true,
      },
      {
        id: "calendar",
        label: "Google Calendar",
        description: "OAuth valido e calendario principale selezionato.",
        state: integrationState(Boolean(status.google.connected && !status.google.expired), true),
        icon: Calendar,
        required: true,
      },
      {
        id: "whatsapp",
        label: "WhatsApp Business",
        description: "Fase 2: non richiesto per l’MVP Voice + CRM + Calendar + chatbot.",
        state: integrationState(Boolean(status.whatsapp.connected && !status.whatsapp.expired), false),
        icon: MessageCircle,
      },
      {
        id: "facebook",
        label: "Meta Lead Ads",
        description: "Fase 2: non richiesto per l’MVP iniziale.",
        state: integrationState(Boolean(status.facebook.connected && !status.facebook.expired), false),
        icon: Facebook,
      },
      {
        id: "e2e",
        label: "Collaudo Voice end-to-end",
        description: "Risulta verificato solo dal flag server-side voice_runtime_verified, che resta OFF finché non viene superato il test con numero reale.",
        state: loading ? "checking" : e2ePassed ? "verified" : "not_configured",
        icon: TestTube2,
        required: true,
      },
    ];
  }, [e2ePassed, loading, localError, status, voiceReadiness]);

  const blockers = items.filter((item) => item.required && !["verified", "active", "connected"].includes(item.state));
  const productionReady = voiceReadiness === "active" && e2ePassed && status.google.connected && !status.google.expired && !integrationsError && !localError;

  return (
    <Card className={productionReady ? "border-green-500/40" : "border-amber-500/40"}>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Prontezza operativa
            </CardTitle>
            <CardDescription className="mt-1">
              Gli stati distinguono configurazione, collegamento tecnico, verifica reale e attivazione.
            </CardDescription>
          </div>
          <Badge variant={productionReady ? "default" : "outline"} className={productionReady ? "bg-green-600" : "border-amber-500 text-amber-700"}>
            {productionReady ? "ATTIVO E VERIFICATO" : `${blockers.length} BLOCCHI`}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {!productionReady && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Voice live non autorizzata</p>
              <p className="text-xs text-muted-foreground mt-1">
                voice_enabled e voice_runtime_verified restano due guardrail distinti. Il secondo richiede il collaudo reale; il primo abilita il servizio soltanto dopo tutte le verifiche.
              </p>
            </div>
          </div>
        )}

        {(integrationsError || localError) && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Stato readiness non verificabile. Il sistema resta bloccato per sicurezza.
          </div>
        )}

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
              </div>
              <StatusBadge state={item.state} />
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          <Button variant="outline" asChild>
            <Link to="/app/integrations">Gestisci integrazioni<ArrowRight className="w-4 h-4 ml-2" /></Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app/tests">Apri Test Center<TestTube2 className="w-4 h-4 ml-2" /></Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
