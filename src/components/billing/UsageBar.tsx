import { cn } from "@/lib/utils";
import type { ResourceUsage } from "@/hooks/useBilling";

interface UsageBarProps {
  label: string;
  usage: ResourceUsage;
  unit: string;
  icon: React.ReactNode;
  overageRate?: string;
}

const statusColors: Record<string, string> = {
  regular: "bg-primary",
  warning: "bg-warning",
  critical: "bg-warning",
  exceeded: "bg-destructive",
  overage: "bg-destructive",
};

const statusLabels: Record<string, { label: string; className: string }> = {
  regular: { label: "Regolare", className: "text-primary bg-primary/10" },
  warning: { label: "In esaurimento", className: "text-warning bg-warning/10" },
  critical: { label: "Quasi esaurito", className: "text-warning bg-warning/10" },
  exceeded: { label: "Limite raggiunto", className: "text-destructive bg-destructive/10" },
  overage: { label: "Overage attivo", className: "text-destructive bg-destructive/10" },
};

export function UsageBar({ label, usage, unit, icon, overageRate }: UsageBarProps) {
  const { used, included, remaining, percentage, status, overageUnits, overageCostCents } = usage;
  const statusInfo = statusLabels[status];
  const barColor = statusColors[status];

  return (
    <div className="p-5 rounded-xl border border-border bg-card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <p className="font-semibold text-sm">{label}</p>
            <p className="text-xs text-muted-foreground">Questo mese</p>
          </div>
        </div>
        <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", statusInfo.className)}>
          {statusInfo.label}
        </span>
      </div>

      {/* Bar */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="font-medium">{used} {unit} usati</span>
          <span className="text-muted-foreground">{included} {unit} inclusi</span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-2.5 rounded-lg bg-muted/50 text-center">
          <p className="text-lg font-bold">{remaining}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Residui</p>
        </div>
        <div className="p-2.5 rounded-lg bg-muted/50 text-center">
          <p className="text-lg font-bold">{Math.round(percentage)}%</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Usato</p>
        </div>
        <div className="p-2.5 rounded-lg bg-muted/50 text-center">
          <p className={cn("text-lg font-bold", overageUnits > 0 ? "text-destructive" : "text-foreground")}>
            {overageUnits > 0 ? `+${overageUnits}` : "0"}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Extra</p>
        </div>
      </div>

      {/* Overage info */}
      {overageUnits > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/10">
          <span className="text-xs text-destructive">Costo extra maturato</span>
          <span className="text-sm font-bold text-destructive">
            {(overageCostCents / 100).toFixed(2)}€
          </span>
        </div>
      )}

      {overageRate && (
        <p className="text-[11px] text-muted-foreground">
          Overage: {overageRate}
        </p>
      )}
    </div>
  );
}
