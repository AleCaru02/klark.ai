import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Info } from "lucide-react";
import { useSearchParams } from "react-router-dom";

interface DebugData {
  connected: boolean;
  reconnect_required?: boolean;
  error?: string;
  refresh_error?: string;
  google_error?: string;
  calendars?: { id: string; summary: string; primary: boolean }[];
  debug?: {
    redirect_uri: string;
    client_id_partial: string;
    supabase_url: string;
    token_exists: boolean;
    token_scope: string | null;
    token_expires_at: string | null;
  };
}

const REQUIRED_REDIRECT_URI = "https://dpabktkvdhaxwpyhehis.supabase.co/functions/v1/google-auth-callback";

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
      <span className="text-muted-foreground min-w-[200px]">{label}:</span>
      <span className={`break-all text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

type FlowStep = "not_started" | "started" | "callback_received" | "token_exchange" | "connected";

function deriveFlowState(logs: any[], dbConnected: boolean): {
  step: FlowStep;
  lastError?: string;
  lastErrorDetail?: string;
  evidence: Record<string, boolean>;
} {
  const evidence: Record<string, boolean> = {
    start: logs.some(l => l.action === "google_oauth.start"),
    callback_received: logs.some(l => l.action === "google_oauth.callback_received" && l.payload_json?.has_code === true),
    callback_ping: logs.some(l => l.action === "google_oauth.callback_ping"),
    callback_no_code: logs.some(l => l.action === "google_oauth.callback_received" && l.payload_json?.has_code === false),
    token_exchange_started: logs.some(l => l.action === "google_oauth.token_exchange_started"),
    token_exchange_success: logs.some(l => l.action === "google_oauth.token_exchange_success"),
    token_exchange_failed: logs.some(l => l.action === "google_oauth.token_exchange_failed"),
    calendar_test_ok: logs.some(l => l.action === "google_oauth.calendar_test_ok"),
    connected: logs.some(l => l.action === "google_oauth.connected"),
    oauth_error: logs.some(l => l.action === "google_oauth.error"),
  };

  if (dbConnected || evidence.connected || evidence.token_exchange_success) return { step: "connected", evidence };
  if (evidence.token_exchange_failed) {
    const failLog = logs.find(l => l.action === "google_oauth.token_exchange_failed");
    return { step: "token_exchange", lastError: "token_exchange_failed", lastErrorDetail: failLog?.payload_json?.google_error_description || failLog?.payload_json?.google_error, evidence };
  }
  if (evidence.token_exchange_started) return { step: "token_exchange", evidence };
  if (evidence.callback_received) return { step: "callback_received", evidence };
  if (evidence.oauth_error) {
    const errLog = logs.find(l => l.action === "google_oauth.error");
    return { step: "callback_received", lastError: errLog?.payload_json?.error, lastErrorDetail: errLog?.payload_json?.error_description, evidence };
  }
  if (evidence.start) return { step: "started", evidence };
  return { step: "not_started", evidence };
}

export default function GoogleCalendarDebug() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const [data, setData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authStartDebug, setAuthStartDebug] = useState<any>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [searchParams] = useSearchParams();

  const oauthError = searchParams.get("error");
  const oauthErrorDesc = searchParams.get("error_description");
  const oauthDetail = searchParams.get("detail");
  const oauthSuccess = searchParams.get("success");

  const currentOrigin = window.location.origin;
  const UX_MODE = "redirect";

  const fetchDebug = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendars?tenant_id=${tenantId}&debug=true`,
        { headers: { Authorization: `Bearer ${session.session.access_token}`, "Content-Type": "application/json" } }
      );
      setData(await response.json());
    } catch (err) {
      setData({ connected: false, error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const fetchAuthStartDebug = async () => {
    if (!tenantId) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth-start?tenant_id=${tenantId}`,
        { headers: { Authorization: `Bearer ${session.session.access_token}`, "Content-Type": "application/json" } }
      );
      const result = await response.json();
      setAuthStartDebug(result.debug || null);
      setAuthUrl(result.auth_url || null);
    } catch {
      // Debug-only request: failure must not block the normal Calendar UI.
    }
  };

  const fetchAuditLogs = async () => {
    if (!tenantId) return;
    // Fetch both tenant-specific AND tenant_id=NULL callback events
    const { data: tenantLogs } = await supabase
      .from("audit_log")
      .select("action, payload_json, created_at, tenant_id")
      .eq("tenant_id", tenantId)
      .like("action", "google%")
      .order("created_at", { ascending: false })
      .limit(20);
    const { data: nullLogs } = await supabase
      .from("audit_log")
      .select("action, payload_json, created_at, tenant_id")
      .is("tenant_id", null)
      .like("action", "google%")
      .order("created_at", { ascending: false })
      .limit(20);
    // Merge and sort by created_at descending
    const all = [...(tenantLogs || []), ...(nullLogs || [])];
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setAuditLogs(all.slice(0, 30));
  };

  useEffect(() => {
    fetchDebug();
    fetchAuthStartDebug();
    fetchAuditLogs();
  }, [tenantId]);

  const flow = deriveFlowState(auditLogs, data?.connected ?? false);

  const StatusIcon = ({ ok }: { ok: boolean | undefined }) =>
    ok ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-destructive" />;

  const StepIndicator = ({ label, reached, active, error }: { label: string; reached: boolean; active?: boolean; error?: boolean }) => (
    <div className="flex items-center gap-2">
      {error ? <XCircle className="h-4 w-4 text-destructive shrink-0" /> :
       reached ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> :
       active ? <Loader2 className="h-4 w-4 animate-spin text-yellow-500 shrink-0" /> :
       <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
      <span className={`text-sm ${reached ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );

  const refreshAll = () => { fetchDebug(); fetchAuthStartDebug(); fetchAuditLogs(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Google Calendar — Debug</h1>
          <p className="text-muted-foreground text-sm">Diagnostica connessione OAuth</p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Aggiorna
        </Button>
      </div>

      {/* OAuth Result from URL params */}
      {(oauthError || oauthSuccess) && (
        <Card className={oauthError ? "border-destructive" : "border-green-500"}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {oauthError ? <XCircle className="h-5 w-5 text-destructive" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
              Risultato OAuth
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {oauthSuccess && <p className="text-green-600 font-semibold">✅ Connessione riuscita!</p>}
            {oauthError && (
              <>
                <Row label="error" value={oauthError} />
                {oauthErrorDesc && <Row label="error_description" value={oauthErrorDesc} />}
                {oauthDetail && <Row label="detail" value={oauthDetail} />}
                {oauthError === "token_exchange_failed" && (
                  <div className="mt-2 p-3 bg-destructive/10 rounded-md text-destructive flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>Probabile <strong>client secret errato</strong> o <strong>redirect_uri mismatch</strong>. Controlla gli audit log sotto per il dettaglio Google.</span>
                  </div>
                )}
                {oauthError === "access_denied" && (
                  <div className="mt-2 p-3 bg-destructive/10 rounded-md text-destructive flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>Consenso negato o app in <strong>Testing</strong> senza l'email nei Test Users.</span>
                  </div>
                )}
                {oauthError === "redirect_uri_mismatch" && (
                  <div className="mt-2 p-3 bg-destructive/10 rounded-md text-destructive flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>Il redirect_uri non corrisponde a quelli autorizzati nella Google Cloud Console.</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Flow Status — single source of truth */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stato flusso OAuth</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-1">
            <Row label="ux_mode" value={UX_MODE} />
            <Row label="Browser origin" value={currentOrigin} />
            <Row label="Redirect URI" value={data?.debug?.redirect_uri || authStartDebug?.redirect_uri || REQUIRED_REDIRECT_URI} />
          </div>

          {/* Step-by-step progress — evidence-based from audit_log */}
          <div className="pt-3 border-t space-y-2">
            <p className="font-medium text-xs uppercase text-muted-foreground tracking-wider">Evidenze reali (audit_log)</p>
            <StepIndicator label="1. OAuth avviato (google_oauth.start)" reached={flow.evidence.start} />
            <StepIndicator
              label="2. Callback raggiunto con code"
              reached={flow.evidence.callback_received}
              error={flow.evidence.oauth_error}
            />
            {flow.evidence.callback_no_code && !flow.evidence.callback_received && (
              <div className="ml-6 text-xs text-yellow-600">
                ⚠️ Callback raggiunto ma SENZA code (solo ping o errore Google)
              </div>
            )}
            <StepIndicator
              label="3. Token exchange tentato"
              reached={flow.evidence.token_exchange_started}
              error={flow.evidence.token_exchange_failed}
            />
            <StepIndicator label="4. Token exchange riuscito" reached={flow.evidence.token_exchange_success} />
            <StepIndicator label="5. Calendar test OK" reached={flow.evidence.calendar_test_ok} />
            <StepIndicator label="6. Connesso" reached={flow.evidence.connected || (data?.connected ?? false)} />
          </div>

          {/* Error detail if stuck */}
          {flow.lastError && (
            <div className="p-3 bg-destructive/10 rounded-md text-destructive text-xs">
              <p className="font-medium">Errore: {flow.lastError}</p>
              {flow.lastErrorDetail && <p className="mt-1">{flow.lastErrorDetail}</p>}
            </div>
          )}

          {/* Callback never reached with code */}
          {flow.evidence.start && !flow.evidence.callback_received && !flow.evidence.connected && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                <span className="font-medium">Il callback non ha ricevuto un code da Google</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {flow.evidence.callback_ping
                  ? "✅ Il callback è raggiungibile (ping OK). Ma Google non sta redirigendo dopo il consenso."
                  : "⚠️ Nessun ping registrato. Verifica che la function sia deployata."}
              </p>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                <li>App in Testing? → Aggiungi la tua email nei <strong>Test Users</strong></li>
                <li>Google Calendar API abilitata?</li>
                <li>Redirect URI: <code className="bg-muted px-1 rounded">{REQUIRED_REDIRECT_URI}</code></li>
                <li>Client ID e Secret dello stesso OAuth Client?</li>
              </ul>
            </div>
          )}

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
              <p className="text-xs text-muted-foreground">
                Flusso <strong>redirect</strong>: non servono Authorized JavaScript Origins. Solo il Redirect URI sopra.
              </p>
            </div>
          </div>

          {authUrl && (
            <div>
              <span className="text-muted-foreground text-xs">Auth URL generato:</span>
              <pre className="bg-muted p-2 rounded text-xs mt-1 overflow-x-auto whitespace-pre-wrap break-all">{authUrl}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin" /> Caricamento...
        </div>
      ) : (
        <>
          {/* Connection Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stato connessione (DB)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <StatusIcon ok={data?.connected} />
                <span className="font-medium">{data?.connected ? "Connesso" : "Non connesso"}</span>
                {data?.reconnect_required && <Badge variant="destructive">Riconnessione necessaria</Badge>}
              </div>
              {data?.error && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{data.error}</span>
                </div>
              )}
              {data?.debug && (
                <div className="space-y-1 text-xs">
                  <Row label="token_exists" value={String(data.debug.token_exists)} />
                  <Row label="token_scope" value={data.debug.token_scope || "—"} />
                  <Row label="token_expires_at" value={data.debug.token_expires_at || "—"} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calendars */}
          {data?.connected && data?.calendars && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Calendari ({data.calendars.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {data.calendars.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun calendario trovato</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {data.calendars.map((cal) => (
                      <li key={cal.id} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        {cal.summary}
                        {cal.primary && <Badge variant="secondary">Principale</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* Audit Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit Log (ultimi 20)</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun log trovato.</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log, i) => (
                    <div key={i} className="border rounded-md p-3 text-xs font-mono space-y-1">
                      <div className="flex justify-between">
                        <Badge variant="outline">{log.action}</Badge>
                        <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString("it-IT")}</span>
                      </div>
                      <pre className="whitespace-pre-wrap text-muted-foreground mt-1">
                        {JSON.stringify(log.payload_json, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checklist Google Cloud Console</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>OAuth Consent Screen → Se in "Testing", aggiungi la tua email come Test User</li>
                <li>Credentials → OAuth 2.0 Client → Tipo: Web application</li>
                <li>Authorized Redirect URIs: <code className="bg-muted px-1 rounded">{REQUIRED_REDIRECT_URI}</code></li>
                <li>Authorized JavaScript Origins: <em>non necessarie</em></li>
                <li>Google Calendar API abilitata</li>
                <li>Client ID e Secret corrispondenti allo stesso OAuth Client</li>
              </ol>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
