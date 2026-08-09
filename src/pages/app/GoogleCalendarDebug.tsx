import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CalendarItem {
  id: string;
  summary: string;
  primary: boolean;
}

interface CalendarStatus {
  connected: boolean;
  calendars: CalendarItem[];
  error?: string;
}

type ActionState = "idle" | "connecting" | "disconnecting" | "refreshing";

const friendlyErrors: Record<string, { title: string; description: string }> = {
  oauth_denied: {
    title: "Autorizzazione non completata",
    description: "L'accesso a Google Calendar non è stato autorizzato. Puoi riprovare quando vuoi.",
  },
  access_denied: {
    title: "Account Google non ancora autorizzato",
    description:
      "La connessione è ancora in fase di collaudo. Questo account Google deve essere autorizzato per il test prima di poter completare il collegamento.",
  },
  invalid_callback: {
    title: "Collegamento non completato",
    description: "Google non ha restituito tutti i dati necessari. Riprova il collegamento.",
  },
  invalid_or_expired_state: {
    title: "Sessione di collegamento scaduta",
    description: "Per sicurezza la richiesta di collegamento è scaduta. Avviala nuovamente da questa pagina.",
  },
  redirect_mismatch: {
    title: "Configurazione Google da completare",
    description: "Il collegamento non può essere concluso finché la configurazione OAuth non è allineata.",
  },
  token_exchange_failed: {
    title: "Google Calendar non è stato collegato",
    description: "L'autorizzazione è arrivata, ma la connessione non è stata finalizzata. Riprova; se persiste, serve un controllo della configurazione.",
  },
  insufficient_scope: {
    title: "Permessi Google incompleti",
    description: "Per usare agenda e appuntamenti servono i permessi richiesti durante il collegamento. Riprova e autorizza le voci richieste.",
  },
  refresh_token_missing: {
    title: "Riconnessione necessaria",
    description: "Google non ha fornito l'autorizzazione necessaria per mantenere il calendario collegato. Riprova il collegamento.",
  },
  oauth_callback_failed: {
    title: "Connessione non completata",
    description: "Si è verificato un problema durante il collegamento. Riprova tra poco.",
  },
};

export default function GoogleCalendarDebug() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<ActionState>("idle");
  const [pageError, setPageError] = useState<string | null>(null);

  const oauthErrorCode = searchParams.get("error");
  const oauthSuccess = searchParams.get("success") === "true";
  const oauthError = useMemo(
    () => (oauthErrorCode ? friendlyErrors[oauthErrorCode] ?? {
      title: "Connessione non completata",
      description: "Il collegamento a Google Calendar non è andato a buon fine. Riprova dalla pagina.",
    } : null),
    [oauthErrorCode],
  );

  const getAccessToken = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Sessione scaduta. Accedi nuovamente.");
    return data.session.access_token;
  }, []);

  const loadStatus = useCallback(async (showRefreshState = false) => {
    if (!tenantId) return;
    if (showRefreshState) setAction("refreshing");
    setPageError(null);
    try {
      const token = await getAccessToken();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendars`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          response.status === 409
            ? "La connessione Google deve essere rinnovata. Disconnetti e collega nuovamente il calendario."
            : "Non riesco a verificare lo stato del calendario in questo momento.",
        );
      }
      setStatus({
        connected: payload.connected === true,
        calendars: Array.isArray(payload.calendars) ? payload.calendars : [],
        error: typeof payload.error === "string" ? payload.error : undefined,
      });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Impossibile verificare Google Calendar.");
    } finally {
      setLoading(false);
      if (showRefreshState) setAction("idle");
    }
  }, [getAccessToken, tenantId]);

  useEffect(() => {
    void loadStatus(false);
  }, [loadStatus]);

  useEffect(() => {
    if (!oauthSuccess) return;
    void loadStatus(false);
    const next = new URLSearchParams(searchParams);
    next.delete("success");
    setSearchParams(next, { replace: true });
  }, [loadStatus, oauthSuccess, searchParams, setSearchParams]);

  const connectGoogle = async () => {
    if (!tenantId || action !== "idle") return;
    setAction("connecting");
    setPageError(null);
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth-start?tenant_id=${encodeURIComponent(tenantId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.auth_url !== "string") {
        throw new Error("Non è stato possibile avviare il collegamento con Google.");
      }
      window.location.assign(payload.auth_url);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Impossibile avviare Google Calendar.");
      setAction("idle");
    }
  };

  const disconnectGoogle = async () => {
    if (action !== "idle") return;
    setAction("disconnecting");
    setPageError(null);
    try {
      const token = await getAccessToken();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth-disconnect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      if (!response.ok) throw new Error("Non è stato possibile scollegare Google Calendar.");
      setStatus({ connected: false, calendars: [] });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Impossibile scollegare Google Calendar.");
    } finally {
      setAction("idle");
    }
  };

  const primaryCalendar = status?.calendars.find((calendar) => calendar.primary);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-sky-600" />
            <h1 className="text-2xl font-bold tracking-tight">Google Calendar</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Collega l'agenda usata dalla tua attività per permettere a ClerkAI di verificare gli orari disponibili e gestire gli appuntamenti secondo le regole configurate.
          </p>
        </div>
        {!loading && status?.connected && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadStatus(true)}
            disabled={action !== "idle"}
          >
            {action === "refreshing" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Aggiorna stato
          </Button>
        )}
      </div>

      {oauthError && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex gap-3 p-4 sm:p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-950">{oauthError.title}</p>
              <p className="text-sm text-amber-900/80">{oauthError.description}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {pageError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex gap-3 p-4 sm:p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold">Impossibile completare l'operazione</p>
              <p className="mt-1 text-sm text-muted-foreground">{pageError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex min-h-44 items-center justify-center gap-3 p-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Verifico lo stato del calendario…
          </CardContent>
        </Card>
      ) : status?.connected ? (
        <Card className="border-emerald-200">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Google Calendar collegato</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    La connessione è attiva. Puoi ora scegliere e usare i calendari disponibili per il flusso appuntamenti.
                  </p>
                </div>
              </div>
              <Badge className="w-fit bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Collegato</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-sm font-medium">Calendari disponibili</p>
              {status.calendars.length ? (
                <div className="mt-3 grid gap-2">
                  {status.calendars.map((calendar) => (
                    <div key={calendar.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <CalendarDays className="h-4 w-4 shrink-0 text-sky-600" />
                        <span className="truncate text-sm font-medium">{calendar.summary}</span>
                      </div>
                      {calendar.primary && <Badge variant="secondary">Principale</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">La connessione è attiva, ma non sono stati trovati calendari modificabili.</p>
              )}
            </div>

            {primaryCalendar && (
              <div className="flex items-start gap-3 rounded-xl bg-sky-50 p-4 text-sm text-sky-950">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
                <p>
                  Il calendario principale rilevato è <strong>{primaryCalendar.summary}</strong>. Prima dell'attivazione definitiva verificheremo disponibilità, creazione appuntamenti e assenza di sovrapposizioni.
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Scollegando Google Calendar, ClerkAI non potrà più leggere disponibilità o creare appuntamenti su Google.
              </p>
              <Button variant="outline" onClick={() => void disconnectGoogle()} disabled={action !== "idle"}>
                {action === "disconnecting" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
                Scollega
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Collega il calendario della tua attività</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["1", "Accedi con Google", "Scegli l'account che contiene il calendario usato per gli appuntamenti."],
                ["2", "Autorizza il calendario", "Concedi solo i permessi necessari a leggere disponibilità e gestire eventi."],
                ["3", "Verifica la connessione", "Torna qui e controlla che lo stato risulti Collegato prima del collaudo."],
              ].map(([number, title, description]) => (
                <div key={number} className="rounded-xl border p-4">
                  <div className="mb-3 grid h-8 w-8 place-items-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">{number}</div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-sky-950">Connessione protetta</p>
                <p className="text-sm text-sky-900/80">
                  L'accesso viene autorizzato direttamente con Google. ClerkAI usa il collegamento soltanto per le funzioni calendario configurate e puoi scollegarlo in qualsiasi momento.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-xs text-muted-foreground">
                Durante il collaudo l'accesso può essere limitato agli account Google autorizzati per il test. Se Google blocca l'accesso, non continuare a riprovare: l'account deve prima essere abilitato.
              </p>
              <Button size="lg" onClick={() => void connectGoogle()} disabled={!tenantId || action !== "idle"}>
                {action === "connecting" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                Collega Google Calendar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prima dell'attivazione</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="font-medium">Disponibilità reali</p>
              <p className="mt-1 text-muted-foreground">Verifichiamo che gli orari occupati non vengano proposti come liberi.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Creazione appuntamenti</p>
              <p className="mt-1 text-muted-foreground">Controlliamo che l'evento venga creato sul calendario corretto con i dati previsti.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Nessuna sovrapposizione</p>
              <p className="mt-1 text-muted-foreground">Eseguiamo il test di concorrenza prima di considerare il calendario pronto per utenti reali.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
