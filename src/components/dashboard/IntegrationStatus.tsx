import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Calendar, CheckCircle2, CircleDashed, CreditCard, Facebook, MessageCircle, Phone, ShieldCheck, TestTube2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";

type ReadinessState = "ready" | "missing" | "optional" | "checking";

type ReadinessItem = {
  id: string;
  label: string;
  description: string;
  state: ReadinessState;
  icon: typeof Phone;
};

function StatusBadge({ state }: { state: ReadinessState }) {
  if (state === "ready") {
    return <Badge className="gap-1 bg-green-600 hover:bg-green-600"><CheckCircle2 className="w-3 h-3" />VERIFICATO</Badge>;
  }
  if (state === "optional") {
    return <Badge variant="secondary" className="gap-1"><CircleDashed className="w-3 h-3" />OPZIONALE</Badge>;
  }
  if (state === "checking") {
    return <Badge variant="outline" className="gap-1"><CircleDashed className="w-3 h-3 animate-spin" />CONTROLLO</Badge>;
  }
  return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />BLOCCO</Badge>;
}

export function IntegrationStatus() {
  const { membership } = useAuth();
  const { status, loading: integrationsLoading, error: integrationsError } = useIntegrationStatus(Boolean(membership));
  const [voiceConfigured, setVoiceConfigured] = useState(false);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(true);

  const billingVerified = import.meta.env.VITE_STRIPE_LIVE_VERIFIED === "true";
  const endToEndVerified = import.meta.env.VITE_E2E_VERIFIED === "true";
  const productionApproved = import.meta.env.VITE_PRODUCTION_READINESS_APPROVED === "true";

  useEffect(() => {
    const tenantId = membership?.tenant_id;
    if (!tenantId) {
      setLocalLoading(false);
      return;
    }

    const fetchLocalReadiness = async () => {
      setLocalLoading(true);
      const [settingsResult, subscriptionResult] = await Promise.all([
        supabase
          .from("settings")
          .select("voice_enabled,twilio_number_sid")
          .eq("tenant_id", tenantId)
          .maybeSingle(),
        supabase
          .from("subscriptions")
          .select("plan_code")
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .maybeSingle(),
      ]);

      setVoiceConfigured(Boolean(settingsResult.data?.voice_enabled && settingsResult.data?.twilio_number_sid));
      setPlanCode(subscriptionResult.data?.plan_code ?? null);
      setLocalLoading(false);
    };

    void fetchLocalReadiness();
  }, [membership?.tenant_id]);

  const loading = integrationsLoading || localLoading;
  const needsWhatsApp = planCode === "combo_start" || planCode === "combo_pro";
  const needsFacebook = planCode === "combo_pro";

  const items = useMemo<ReadinessItem[]>(() => {
    const integrationState = (connected: boolean, required: boolean): ReadinessState => {
      if (loading) return "checking";
      if (connected) return "ready";
      return required ? "missing" : "optional";
    };

    return [
      {
        id: "voice",
        label: "Telefonia voice",
        description: "Numero assegnato e funzione voice abilitata per il tenant.",
        state: loading ? "checking" : voiceConfigured ? "ready" : "missing",
        icon: Phone,
      },
      {
        id: "calendar",
        label: "Google Calendar",
        description: "OAuth valido e calendario principale selezionato.",
        state: integrationState(Boolean(status.google.connected && !status.google.expired), true),
        icon: Calendar,
      },
      {
        id: "whatsapp",
        label: "WhatsApp Business",
        description: needsWhatsApp ? "Richiesto dal piano attivo." : "Non richiesto dal piano Voice Agenda.",
        state: integrationState(Boolean(status.whatsapp.connected && !status.whatsapp.expired), needsWhatsApp),
        icon: MessageCircle,
      },
      {
        id: "facebook",
        label: "Meta Lead Ads",
        description: needsFacebook ? "Richiesto dal piano Full." : "Modulo non richiesto dal piano attivo.",
        state: integrationState(Boolean(status.facebook.connected && !status.facebook.expired), needsFacebook),
        icon: Facebook,
      },
      {
        id: "billing",
        label: "Billing Stripe live",
        description: "Webhook, prodotti, prezzi, meters e pagamento reale verificati.",
        state: billingVerified ? "ready" : "missing",
        icon: CreditCard,
      },
      {
        id: "e2e",
        label: "Collaudo end-to-end",
        description: "Chiamata, agenda, messaggi, errori, idempotenza e isolamento tenant testati.",
        state: endToEndVerified ? "ready" : "missing",
        icon: TestTube2,
      },
    ];
  }, [billingVerified, endToEndVerified, loading, needsFacebook, needsWhatsApp, status, voiceConfigured]);

  const blockers = items.filter((item) => item.state === "missing");
  const readyForProduction = productionApproved && blockers.length === 0 && !integrationsError;

  return (
    <Card className={readyForProduction ? "border-green-500/40" : "border-amber-500/40"}>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Prontezza operativa
            </CardTitle>
            <CardDescription className="mt-1">
              Configurato non significa ancora testato o autorizzato alla produzione.
            </CardDescription>
          </div>
          <Badge variant={readyForProduction ? "default" : "outline"} className={readyForProduction ? "bg-green-600" : "border-amber-500 text-amber-700"}>
            {readyForProduction ? "PRODUZIONE APPROVATA" : `${blockers.length} BLOCCHI`}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {!productionApproved && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Go-live non autorizzato</p>
              <p className="text-xs text-muted-foreground mt-1">
                L'approvazione deve essere impostata esplicitamente solo dopo provider, billing e test end-to-end completati.
              </p>
            </div>
          </div>
        )}

        {integrationsError && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Stato integrazioni non verificabile. Il sistema resta bloccato per sicurezza.
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
