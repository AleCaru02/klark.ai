import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  Bell,
  Calendar,
  Check,
  CreditCard,
  Mail,
  MessageCircle,
  Phone,
  Shield,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useBilling } from "@/hooks/useBilling";
import { type FeatureFlags, usePlanFeatures } from "@/hooks/usePlanFeatures";
import { UsageBar } from "@/components/billing/UsageBar";
import { BillingAlerts } from "@/components/billing/BillingAlerts";
import { plans } from "@/config/plans";
import { product } from "@/config/product";

export default function Billing() {
  const {
    loading,
    plan,
    subscription,
    voiceUsage,
    waUsage,
    alerts,
    totalOverageCents,
    overageMode,
  } = useBilling();
  const { flags } = usePlanFeatures();

  const moduleLabels: { key: keyof FeatureFlags; label: string }[] = [
    { key: "voice_enabled", label: "Voce AI" },
    { key: "calendar_enabled", label: "Google Calendar" },
    { key: "whatsapp_enabled", label: "WhatsApp" },
    { key: "crm_basic_enabled", label: "CRM base" },
    { key: "crm_advanced_enabled", label: "CRM avanzato" },
    { key: "followup_basic_enabled", label: "Follow-up base" },
    { key: "followup_advanced_enabled", label: "Follow-up avanzato" },
    { key: "ads_enabled", label: "Meta Lead Ads" },
    { key: "ai_training_basic_enabled", label: "Training base" },
    { key: "ai_training_advanced_enabled", label: "Training avanzato" },
    { key: "analytics_basic_enabled", label: "Analytics base" },
    { key: "analytics_advanced_enabled", label: "Analytics avanzato" },
    { key: "integrations_enabled", label: "Integrazioni avanzate" },
  ];

  const formatDate = (date: string | null) =>
    date
      ? new Date(date).toLocaleDateString("it-IT", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" role="status" aria-live="polite">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="sr-only">Caricamento fatturazione</span>
      </div>
    );
  }

  const publicPlan = plan ? plans.find((candidate) => candidate.code === plan.code) : undefined;
  const databaseMonthlyPrice = plan ? plan.monthly_price_cents / 100 : null;
  const priceMismatch = Boolean(
    publicPlan && databaseMonthlyPrice !== null && publicPlan.priceMonth !== databaseMonthlyPrice,
  );
  const stripeVerified = import.meta.env.VITE_STRIPE_LIVE_VERIFIED === "true";
  const hasActiveSubscription = subscription?.status === "active";
  const hasVoice = (plan?.included_voice_minutes ?? 0) > 0;
  const hasWhatsApp = (plan?.included_wa_messages ?? 0) > 0;
  const changePlanSubject = encodeURIComponent("Richiesta modifica piano ClerkAI");
  const changePlanBody = encodeURIComponent(
    `Richiedo una verifica del piano associato al mio account. Piano attuale: ${plan?.name || "nessun piano"}.`,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Fatturazione</h1>
        <p className="text-muted-foreground">Piano, consumi, soglie e stato reale del sistema di pagamento.</p>
      </div>

      {!stripeVerified && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium">Pagamenti online non ancora verificati</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Il portale Stripe, il rinnovo automatico e l'aggiornamento del metodo di pagamento restano disabilitati finché i test live non sono completati.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {priceMismatch && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium">Listino non riconciliato</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Il database indica {databaseMonthlyPrice} €/mese, mentre il listino pubblico indica {publicPlan?.priceMonth} €/mese. Il piano non deve essere venduto o modificato finché database, Stripe e contratto non coincidono.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <CardTitle>{plan?.name || "Nessun piano associato"}</CardTitle>
                <CardDescription>Dati letti dal database dell'organizzazione</CardDescription>
              </div>
            </div>
            <Badge variant={plan ? "default" : "secondary"} className="text-base px-4 py-1.5">
              {databaseMonthlyPrice === null ? "Non attivo" : `${databaseMonthlyPrice.toFixed(0)} €/mese`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <p className="text-xs text-muted-foreground mb-1">Prossimo rinnovo</p>
              <p className="font-semibold text-sm">{formatDate(subscription?.period_end ?? null)}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <p className="text-xs text-muted-foreground mb-1">Periodo</p>
              <p className="font-semibold text-sm">
                {formatDate(subscription?.period_start ?? null)} — {formatDate(subscription?.period_end ?? null)}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <p className="text-xs text-muted-foreground mb-1">Stato</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={hasActiveSubscription ? "default" : "secondary"}>
                  {hasActiveSubscription ? "Attivo" : subscription?.status || "Non attivo"}
                </Badge>
                {plan && (
                  <Badge variant="outline" className="text-[10px]">
                    <Shield className="w-3 h-3 mr-1" aria-hidden="true" />
                    {overageMode === "overage" ? "Extra consentiti" : "Limite morbido"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {plan && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
              {moduleLabels.map(({ key, label }) => {
                const enabled = Boolean(flags[key]);
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                      enabled ? "bg-primary/5 text-foreground" : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {enabled ? (
                      <Check className="w-3 h-3 text-primary shrink-0" aria-hidden="true" />
                    ) : (
                      <X className="w-3 h-3 text-muted-foreground/50 shrink-0" aria-hidden="true" />
                    )}
                    {label}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${product.supportEmail}?subject=${changePlanSubject}&body=${changePlanBody}`}>
                <Mail className="w-4 h-4 mr-2" aria-hidden="true" />
                Richiedi modifica piano
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!stripeVerified || !hasActiveSubscription}
              title={!stripeVerified ? "Portale Stripe non verificato" : undefined}
            >
              <CreditCard className="w-4 h-4 mr-2" aria-hidden="true" />
              Aggiorna metodo di pagamento
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-5">
        {hasVoice && (
          <UsageBar
            label="Minuti voce"
            usage={voiceUsage}
            unit="min"
            icon={<Phone className="w-4 h-4 text-primary" aria-hidden="true" />}
            overageRate={plan ? `${(plan.overage_voice_cent_per_min / 100).toFixed(2)} €/min` : undefined}
          />
        )}
        {hasWhatsApp && (
          <UsageBar
            label="Messaggi WhatsApp"
            usage={waUsage}
            unit="msg"
            icon={<MessageCircle className="w-4 h-4 text-primary" aria-hidden="true" />}
            overageRate={plan ? `${(plan.overage_wa_cent_per_msg / 100).toFixed(2)} €/msg` : undefined}
          />
        )}
        {!hasVoice && !hasWhatsApp && (
          <Card className="md:col-span-2">
            <CardContent className="py-8 text-center text-muted-foreground">
              Nessun consumo disponibile perché non risulta un piano operativo.
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4" aria-hidden="true" />
            Stima costi extra del periodo
          </CardTitle>
          <CardDescription>La cifra resta una stima finché Stripe e i meter non sono verificati.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/50">
            <div className="space-y-1">
              {totalOverageCents > 0 ? (
                <>
                  <p className="text-sm font-medium">Consumo oltre la quota inclusa</p>
                  <p className="text-xs text-muted-foreground">
                    {voiceUsage.overageUnits > 0 && `Voce: +${voiceUsage.overageUnits} min`}
                    {voiceUsage.overageUnits > 0 && waUsage.overageUnits > 0 && " · "}
                    {waUsage.overageUnits > 0 && `WhatsApp: +${waUsage.overageUnits} messaggi`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nessun costo extra stimato dai dati disponibili.</p>
              )}
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${totalOverageCents > 0 ? "text-destructive" : "text-primary"}`}>
                {(totalOverageCents / 100).toFixed(2)} €
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">stima</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4" aria-hidden="true" />
            Avvisi consumi
          </CardTitle>
          <CardDescription>Soglie configurate per il piano nel database.</CardDescription>
        </CardHeader>
        <CardContent>
          <BillingAlerts alerts={alerts} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4" aria-hidden="true" />
            Fatture
          </CardTitle>
          <CardDescription>Documenti emessi dal provider di pagamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
            <p className="text-sm">
              {hasActiveSubscription
                ? "Nessuna fattura disponibile nei dati correnti."
                : "Le fatture saranno disponibili soltanto dopo un pagamento verificato."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
