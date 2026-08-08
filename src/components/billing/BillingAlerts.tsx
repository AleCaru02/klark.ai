import { AlertTriangle, Bell, CheckCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UsageAlert } from "@/hooks/useBilling";

interface BillingAlertsProps {
  alerts: UsageAlert[];
}

const iconMap: Record<string, React.ReactNode> = {
  threshold_70: <Info className="w-4 h-4 text-warning" />,
  threshold_85: <AlertTriangle className="w-4 h-4 text-warning" />,
  threshold_100: <AlertTriangle className="w-4 h-4 text-destructive" />,
  overage_active: <Bell className="w-4 h-4 text-destructive" />,
};

const bgMap: Record<string, string> = {
  threshold_70: "bg-warning/5 border-warning/20",
  threshold_85: "bg-warning/10 border-warning/20",
  threshold_100: "bg-destructive/5 border-destructive/20",
  overage_active: "bg-destructive/10 border-destructive/20",
};

export function BillingAlerts({ alerts }: BillingAlertsProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
        <CheckCircle className="w-5 h-5 text-primary" />
        <div>
          <p className="text-sm font-medium">Consumi nella norma</p>
          <p className="text-xs text-muted-foreground">Nessun avviso attivo per questo periodo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "flex items-start gap-3 p-3.5 rounded-xl border",
            bgMap[alert.alert_type] || "bg-muted border-border"
          )}
        >
          <div className="mt-0.5">
            {iconMap[alert.alert_type] || <Info className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {alert.message || `Soglia ${alert.threshold_percent}% raggiunta per ${alert.resource === "voice" ? "minuti voice" : "messaggi WhatsApp"}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(alert.sent_at).toLocaleDateString("it-IT", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
