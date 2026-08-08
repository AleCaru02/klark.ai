import { ReactNode } from "react";
import { Loader2, Lock } from "lucide-react";
import { usePlanFeatures, FeatureFlags } from "@/hooks/usePlanFeatures";

interface FeatureGateProps {
  feature: keyof FeatureFlags;
  title: string;
  description: string;
  children: ReactNode;
}

export function FeatureGate({ feature, title, description, children }: FeatureGateProps) {
  const { hasFeature, planName, serviceStatus, loading } = usePlanFeatures();

  if (loading) {
    return (
      <div className="min-h-40 rounded-2xl border bg-muted/20 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Verifica autorizzazioni in corso…
        </div>
      </div>
    );
  }

  if (hasFeature(feature)) return <>{children}</>;

  const inactive = serviceStatus && serviceStatus !== "active";

  return (
    <div className="space-y-6">
      <div className="relative rounded-2xl border-2 border-dashed border-border bg-muted/30 p-8 md:p-12 text-center">
        <div className="mx-auto max-w-md space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">{inactive ? "Servizio non attivo" : title}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {inactive
                ? `Stato amministrativo: ${serviceStatus}. L'operatività viene abilitata dall'amministratore ClerkAI dopo configurazione e collaudo.`
                : description}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {inactive ? `Account ${serviceStatus}` : `Non incluso nel piano ${planName || "assegnato"}`}
          </div>
        </div>
      </div>
    </div>
  );
}
