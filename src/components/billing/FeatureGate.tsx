import { ReactNode } from "react";
import { Lock, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanFeatures, FeatureFlags } from "@/hooks/usePlanFeatures";
import { Link } from "react-router-dom";

interface FeatureGateProps {
  /** The feature flag key to check */
  feature: keyof FeatureFlags;
  /** Title shown when locked */
  title: string;
  /** Description of what this feature does */
  description: string;
  /** The content to render when feature is enabled */
  children: ReactNode;
}

export function FeatureGate({ feature, title, description, children }: FeatureGateProps) {
  const { hasFeature, getUpgradePlan, planName, loading } = usePlanFeatures();

  if (loading) return <>{children}</>;

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  const upgradeTo = getUpgradePlan(feature);

  return (
    <div className="space-y-6">
      {/* Locked overlay card */}
      <div className="relative rounded-2xl border-2 border-dashed border-border bg-muted/30 p-8 md:p-12 text-center">
        <div className="mx-auto max-w-md space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-muted-foreground" />
          </div>

          <div>
            <h2 className="text-xl font-bold mb-2">{title}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {description}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
            Non incluso nel piano {planName || "attuale"}
          </div>

          <div>
            <Button asChild>
              <Link to="/app/billing">
                Passa a {upgradeTo}
                <ArrowUpRight className="w-4 h-4 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
