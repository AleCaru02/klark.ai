import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchIntegrationStatus } from "@/hooks/useIntegrationStatus";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Download, 
  Link, 
  Unlink,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  XCircle
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { SyncResult } from "@/hooks/useSyncPolling";

interface SyncStatusBoxProps {
  appointmentsCount: number;
  onImportClick: () => void;
  isImporting: boolean;
  onSyncNowClick: () => void;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  lastSyncError: string | null;
}

interface ConnectionStatus {
  calendarId: string | null;
  hasGoogleConnection: boolean;
  error: string | null;
  scope: string | null;
}

export function SyncStatusBox({ 
  appointmentsCount, 
  onImportClick, 
  isImporting,
  onSyncNowClick,
  isSyncing,
  lastSyncResult,
  lastSyncError,
}: SyncStatusBoxProps) {
  const { membership } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>({
    calendarId: null,
    hasGoogleConnection: false,
    error: null,
    scope: null,
  });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const tenantId = membership?.tenant_id;

  useEffect(() => {
    if (tenantId) {
      fetchConnectionStatus();
    }
  }, [tenantId]);

  // Check URL for OAuth callback results
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast.success("Google Calendar connesso con successo!");
      window.history.replaceState({}, "", window.location.pathname);
      fetchConnectionStatus();
    } else if (params.get("error")) {
      const error = params.get("error");
      toast.error(`Errore connessione: ${error}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const fetchConnectionStatus = async () => {
    if (!tenantId) return;

    setLoading(true);
    try {
      const integration = await fetchIntegrationStatus();

      setStatus({
        calendarId: integration.google.calendar_id || null,
        hasGoogleConnection: !!integration.google.connected,
        error: null,
        scope: integration.google.scope || null,
      });
    } catch (error) {
      console.error("Error fetching connection status:", error);
      setStatus((prev) => ({ ...prev, error: "Errore nel recupero stato" }));
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    if (!tenantId) {
      toast.error("Tenant non trovato");
      return;
    }

    setConnecting(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast.error("Sessione scaduta, effettua nuovamente il login");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth-start?tenant_id=${tenantId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.auth_url) {
        throw new Error(result.error || "Errore nella generazione URL OAuth");
      }

      window.location.href = result.auth_url;
    } catch (error) {
      console.error("Error starting Google auth:", error);
      toast.error("Errore nella connessione a Google Calendar");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!tenantId) return;

    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("google-auth-disconnect", {
        body: { tenant_id: tenantId },
      });

      if (error) {
        throw error;
      }

      toast.success("Google Calendar disconnesso");
      fetchConnectionStatus();
    } catch (error) {
      console.error("Error disconnecting Google:", error);
      toast.error("Errore nella disconnessione");
    } finally {
      setDisconnecting(false);
    }
  };

  const formatLastSync = (dateString: string | null | undefined) => {
    if (!dateString) return "Mai sincronizzato";
    const date = new Date(dateString);
    return format(date, "d MMM yyyy 'alle' HH:mm", { locale: it });
  };

  // Calculate if there were any changes in last sync
  const hasChanges = lastSyncResult && (
    lastSyncResult.imported_count > 0 ||
    lastSyncResult.updated_count > 0 ||
    lastSyncResult.canceled_count > 0 ||
    lastSyncResult.rescheduled_count > 0
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Caricamento stato sync...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="font-semibold">Stato Sincronizzazione</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Status info */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Google Connection Status */}
              {status.hasGoogleConnection ? (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connesso
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Non connesso
                </Badge>
              )}

              {/* Calendar ID */}
              {status.hasGoogleConnection && status.calendarId && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                  <Calendar className="w-3 h-3" />
                  <span className="truncate max-w-[150px]" title={status.calendarId}>
                    {status.calendarId === "primary" ? "Principale" : status.calendarId}
                  </span>
                </div>
              )}

              {/* Last sync time */}
              {status.hasGoogleConnection && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>
                    {isSyncing ? "Sincronizzazione in corso..." : formatLastSync(lastSyncResult?.last_sync_at)}
                  </span>
                </div>
              )}

              {/* Events count */}
              <Badge variant="secondary">
                {appointmentsCount} eventi
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {!status.hasGoogleConnection ? (
                <Button onClick={handleConnectGoogle} disabled={connecting}>
                  {connecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Connessione...
                    </>
                  ) : (
                    <>
                      <Link className="w-4 h-4 mr-2" />
                      Connetti Google Calendar
                    </>
                  )}
                </Button>
              ) : (
                <>
                  {/* Sync now button */}
                  <Button 
                    onClick={onSyncNowClick} 
                    disabled={isSyncing} 
                    variant="outline"
                    size="sm"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Sync...
                      </>
                    ) : (
                      <>
                        <ArrowUpDown className="w-4 h-4 mr-2" />
                        Sync ora
                      </>
                    )}
                  </Button>

                  {/* Import button */}
                  <Button onClick={onImportClick} disabled={isImporting} variant="default" size="sm">
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Import completo
                      </>
                    )}
                  </Button>

                  {/* Disconnect button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnectGoogle}
                    disabled={disconnecting}
                    className="text-destructive hover:text-destructive"
                  >
                    {disconnecting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Unlink className="w-4 h-4" />
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Sync counters - show if last sync had results */}
          {status.hasGoogleConnection && lastSyncResult && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <span className="text-xs text-muted-foreground mr-2">Ultimo sync:</span>
              
              {lastSyncResult.imported_count > 0 && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {lastSyncResult.imported_count} nuovi
                </Badge>
              )}
              
              {lastSyncResult.updated_count > 0 && (
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  {lastSyncResult.updated_count} aggiornati
                </Badge>
              )}
              
              {lastSyncResult.canceled_count > 0 && (
                <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                  <XCircle className="w-3 h-3 mr-1" />
                  {lastSyncResult.canceled_count} cancellati
                </Badge>
              )}
              
              {lastSyncResult.rescheduled_count > 0 && (
                <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/30">
                  <RotateCcw className="w-3 h-3 mr-1" />
                  {lastSyncResult.rescheduled_count} spostati
                </Badge>
              )}
              
              {lastSyncResult.skipped_count > 0 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  {lastSyncResult.skipped_count} invariati
                </Badge>
              )}

              {!hasChanges && lastSyncResult.skipped_count === 0 && (
                <span className="text-xs text-muted-foreground">Nessun evento da sincronizzare</span>
              )}
            </div>
          )}

          {/* Sync errors */}
          {lastSyncError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              <AlertCircle className="w-4 h-4" />
              <span>{lastSyncError}</span>
            </div>
          )}

          {lastSyncResult?.errors && lastSyncResult.errors.length > 0 && (
            <div className="flex flex-col gap-1 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">{lastSyncResult.errors.length} errori durante la sync:</span>
              </div>
              <ul className="list-disc list-inside text-xs ml-4">
                {lastSyncResult.errors.slice(0, 3).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {lastSyncResult.errors.length > 3 && (
                  <li>...e altri {lastSyncResult.errors.length - 3} errori</li>
                )}
              </ul>
            </div>
          )}

          {/* Help text when not connected */}
          {!status.hasGoogleConnection && (
            <p className="text-sm text-muted-foreground">
              Connetti il tuo Google Calendar per sincronizzare automaticamente gli appuntamenti.
            </p>
          )}

          {/* Polling info */}
          {status.hasGoogleConnection && (
            <p className="text-xs text-muted-foreground">
              Sincronizzazione automatica ogni 15 secondi • Webhook per sync istantanea attivo
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
