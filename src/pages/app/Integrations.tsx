import { useState, useEffect } from "react";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar, Check, Link2, Unlink, Loader2, AlertCircle, ChevronRight, Facebook, CheckCircle2, AlertTriangle, Phone, MessageCircle, Video } from "lucide-react";
import { toast } from "sonner";
import { useFacebookLeadAds } from "@/hooks/useFacebookLeadAds";
import { useWhatsAppIntegration } from "@/hooks/useWhatsAppIntegration";

interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
}

interface FacebookForm {
  id: string;
  tenant_id: string;
  external_form_id: string;
  form_name: string | null;
  page_id: string | null;
  page_name: string | null;
  lead_count: number;
  is_active: boolean;
}

export default function Integrations() {
  const { membership } = useAuth();
  const [searchParams] = useSearchParams();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>("");
  const [isSavingCalendar, setIsSavingCalendar] = useState(false);

  const tenantId = membership?.tenant_id;

  // Check for OAuth callback status
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "true") {
      toast.success("Google Calendar connesso con successo!");
      // Clear URL params
      window.history.replaceState({}, "", "/app/integrations");
    } else if (error) {
      const errorMessages: Record<string, string> = {
        missing_params: "Parametri mancanti nella risposta OAuth",
        invalid_state: "Stato OAuth non valido",
        token_exchange_failed: "Scambio token fallito",
        access_denied: "Accesso negato",
        storage_failed: "Errore nel salvataggio delle credenziali",
        server_config: "Errore di configurazione del server",
        internal_error: "Errore interno del server",
      };
      toast.error(errorMessages[error] || `Errore: ${error}`);
      window.history.replaceState({}, "", "/app/integrations");
    }
  }, [searchParams]);

  // Check connection status and fetch calendars
  useEffect(() => {
    if (!tenantId) return;

    checkConnectionStatus();
  }, [tenantId]);

  const checkConnectionStatus = async () => {
    if (!tenantId) return;

    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        setIsLoading(false);
        return;
      }

      // Fetch calendars with tenant_id
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendars?tenant_id=${tenantId}`,
        {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (result.connected) {
        setIsConnected(true);
        setCalendars(result.calendars || []);

        // Get saved calendar_id from settings
        const { data: settings } = await supabase
          .from("settings")
          .select("calendar_id")
          .eq("tenant_id", tenantId)
          .single();

        if (settings?.calendar_id) {
          setSelectedCalendarId(settings.calendar_id);
        } else if (result.calendars?.length > 0) {
          // Default to primary or first calendar
          const primary = result.calendars.find((c: GoogleCalendar) => c.primary);
          setSelectedCalendarId(primary?.id || result.calendars[0].id);
        }
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error("Error checking connection:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!tenantId) {
      toast.error("Tenant non trovato");
      return;
    }

    setIsConnecting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error("Sessione non valida");
        setIsConnecting(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth-start?tenant_id=${tenantId}`,
        {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (result.auth_url) {
        // Redirect to Google OAuth
        window.location.href = result.auth_url;
      } else {
        toast.error(result.error || "Errore durante la connessione");
        setIsConnecting(false);
      }
    } catch (error) {
      console.error("Error starting OAuth:", error);
      toast.error("Errore durante la connessione");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!tenantId) return;

    setIsDisconnecting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error("Sessione non valida");
        setIsDisconnecting(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth-disconnect`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tenant_id: tenantId }),
        }
      );

      const result = await response.json();

      if (result.success) {
        setIsConnected(false);
        setCalendars([]);
        setSelectedCalendarId("");
        toast.success("Google Calendar disconnesso");
      } else {
        toast.error(result.error || "Errore durante la disconnessione");
      }
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Errore durante la disconnessione");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleCalendarChange = async (calendarId: string) => {
    if (!tenantId) return;

    setSelectedCalendarId(calendarId);
    setIsSavingCalendar(true);

    try {
      const { error } = await supabase
        .from("settings")
        .upsert(
          { tenant_id: tenantId, calendar_id: calendarId },
          { onConflict: "tenant_id" }
        );

      if (error) {
        console.error("Error saving calendar:", error);
        toast.error("Errore nel salvataggio del calendario");
      } else {
        toast.success("Calendario selezionato salvato");
      }
    } catch (error) {
      console.error("Error saving calendar:", error);
      toast.error("Errore nel salvataggio del calendario");
    } finally {
      setIsSavingCalendar(false);
    }
  };

  return (
    <FeatureGate feature="integrations_enabled" title="Integrazioni" description="Collega Google Calendar, WhatsApp, Meta Lead Ads e altri servizi. Disponibile dal piano Voice Agenda + WhatsApp.">
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1">Integrazioni</h1>
        <p className="text-muted-foreground">
          Collega i servizi esterni per automatizzare il tuo studio
        </p>
      </div>

      {/* Google Calendar Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Google Calendar
                  {isConnected && (
                    <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                      <Check className="w-3 h-3 mr-1" />
                      Connesso
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Sincronizza appuntamenti e gestisci la disponibilità
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifica connessione...
            </div>
          ) : isConnected ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Seleziona calendario
                </label>
                <Select
                  value={selectedCalendarId}
                  onValueChange={handleCalendarChange}
                  disabled={isSavingCalendar}
                >
                  <SelectTrigger className="w-full md:w-80">
                    <SelectValue placeholder="Seleziona un calendario" />
                  </SelectTrigger>
                  <SelectContent>
                    {calendars.map((calendar) => (
                      <SelectItem key={calendar.id} value={calendar.id}>
                        {calendar.summary}
                        {calendar.primary && " (Principale)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isSavingCalendar && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Salvataggio...
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
              >
                {isDisconnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Disconnessione...
                  </>
                ) : (
                  <>
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnetti
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connetti il tuo Google Calendar per permettere alla segretaria AI di:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Verificare la tua disponibilità in tempo reale</li>
                <li>Creare, spostare e cancellare appuntamenti</li>
                <li>Inviare notifiche automatiche via WhatsApp</li>
              </ul>
              <Button onClick={handleConnect} disabled={isConnecting}>
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connessione...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    Connetti Google Calendar
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Google Meet Card */}
      <GoogleMeetCard googleCalendarConnected={isConnected} />

      {/* Facebook Lead Ads Card with Form Selector */}
      <FacebookLeadAdsCard />

      {/* WhatsApp Business Card */}
      <WhatsAppCard />

      {/* Twilio Voice Card */}
      <TwilioVoiceCard />

      {/* Zoom Card */}
      <ZoomCard />
    </div>
    </FeatureGate>
  );
}

function GoogleMeetCard({ googleCalendarConnected }: { googleCalendarConnected: boolean }) {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;

  const { data: settings } = useQuery({
    queryKey: ["meet-provider-setting", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from("settings")
        .select("default_meeting_provider")
        .eq("tenant_id", tenantId)
        .single();
      return data;
    },
    enabled: !!tenantId,
  });

  const isDefault = (settings as any)?.default_meeting_provider === "google_meet" || 
    (!(settings as any)?.default_meeting_provider && googleCalendarConnected);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Video className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Google Meet
                {googleCalendarConnected ? (
                  isDefault ? (
                    <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                      <Check className="w-3 h-3 mr-1" />
                      Provider predefinito
                    </Badge>
                  ) : (
                    <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                      <Check className="w-3 h-3 mr-1" />
                      Disponibile
                    </Badge>
                  )
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    Non disponibile
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Genera link Google Meet automaticamente per gli appuntamenti online
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {googleCalendarConnected ? (
          <>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">
                Google Meet è disponibile tramite la connessione Google Calendar
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {isDefault
                ? "Google Meet è il provider predefinito per i tuoi appuntamenti online."
                : "Puoi impostare Google Meet come provider predefinito nelle Impostazioni Integrazioni."}
            </p>
            <Link to="/app/settings/integrations">
              <Button variant="outline" size="sm">
                <ChevronRight className="w-4 h-4 mr-1" />
                Configura provider meeting
              </Button>
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Per usare Google Meet come provider per gli appuntamenti online, devi prima collegare Google Calendar.
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Link Meet generati automaticamente</li>
              <li>Inseriti negli appuntamenti e nelle notifiche</li>
              <li>Nessuna configurazione aggiuntiva necessaria</li>
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FacebookLeadAdsCard() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const queryClient = useQueryClient();
  const { isLoading: hookLoading, envConfigured, connected, totalImports } = useFacebookLeadAds();

  // Fetch forms
  const { data: forms = [], isLoading: formsLoading } = useQuery({
    queryKey: ["facebook-forms", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("facebook_forms")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("last_lead_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as FacebookForm[];
    },
    enabled: !!tenantId,
  });

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["facebook-settings", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("settings")
        .select("active_facebook_form_id")
        .eq("tenant_id", tenantId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Set active form mutation
  const setActiveFormMutation = useMutation({
    mutationFn: async (formId: string | null) => {
      if (!tenantId) throw new Error("No tenant");
      
      // Update settings
      const { error: settingsError } = await supabase
        .from("settings")
        .upsert(
          { tenant_id: tenantId, active_facebook_form_id: formId },
          { onConflict: "tenant_id" }
        );
      if (settingsError) throw settingsError;

      // Update is_active on all forms
      await supabase
        .from("facebook_forms")
        .update({ is_active: false })
        .eq("tenant_id", tenantId);

      if (formId) {
        await supabase
          .from("facebook_forms")
          .update({ is_active: true })
          .eq("id", formId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facebook-forms"] });
      queryClient.invalidateQueries({ queryKey: ["facebook-settings"] });
      toast.success("Campagna attiva aggiornata");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const activeForm = forms.find((f) => f.id === settings?.active_facebook_form_id);
  const isLoading = hookLoading || formsLoading || settingsLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
              <Facebook className="w-6 h-6 text-[#1877F2]" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Facebook Lead Ads
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : !envConfigured ? (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    Disattivo
                  </Badge>
                ) : connected ? (
                  <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                    <Check className="w-3 h-3 mr-1" />
                    Connesso
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                    Non connesso
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Importa automaticamente i lead dalle campagne Facebook
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active Form Status */}
        {connected && (
          <>
            <div className="rounded-lg border p-4 bg-muted/30">
              <Label className="text-sm text-muted-foreground">Campagna attualmente attiva per CRM e chiamate</Label>
              {activeForm ? (
                <div className="flex items-center gap-2 mt-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="font-medium">{activeForm.form_name || activeForm.external_form_id}</span>
                  {activeForm.page_name && (
                    <Badge variant="secondary">{activeForm.page_name}</Badge>
                  )}
                  <Badge variant="outline">{activeForm.lead_count} lead</Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span>Nessuna campagna selezionata - i lead non verranno sincronizzati nel CRM</span>
                </div>
              )}
            </div>

            {/* Form Selector */}
            {forms.length > 0 && (
              <div className="space-y-2">
                <Label>Seleziona campagna da sincronizzare</Label>
                <p className="text-xs text-muted-foreground">
                  Solo i lead della campagna selezionata verranno inseriti nel CRM e nella coda chiamate
                </p>
                <Select
                  value={settings?.active_facebook_form_id || "none"}
                  onValueChange={(value) => 
                    setActiveFormMutation.mutate(value === "none" ? null : value)
                  }
                  disabled={setActiveFormMutation.isPending}
                >
                  <SelectTrigger className="w-full md:w-96">
                    <SelectValue placeholder="Seleziona una campagna..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="none">Nessuna campagna attiva</SelectItem>
                    {forms.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        <span className="flex items-center gap-2">
                          {form.form_name || form.external_form_id}
                          {form.page_name && <span className="text-muted-foreground">({form.page_name})</span>}
                          <span className="text-xs text-muted-foreground ml-1">• {form.lead_count} lead</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}

        {connected && (
          <p className="text-sm text-muted-foreground">
            {totalImports} lead importati in totale
          </p>
        )}

        <Link to="/app/integrations/meta-leadads">
          <Button variant="outline" className="w-full sm:w-auto">
            Gestisci integrazione
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function WhatsAppCard() {
  const { integration, loading, connecting, isConnected, connect, disconnect } = useWhatsAppIntegration();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                WhatsApp Business
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isConnected ? (
                  <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                    <Check className="w-3 h-3 mr-1" />
                    Connesso
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    Non connesso
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Invia conferme, promemoria e notifiche automatiche via WhatsApp
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && integration ? (
          <>
            <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
              {integration.display_phone_number && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm">Numero: <strong>{integration.display_phone_number}</strong></span>
                </div>
              )}
              {integration.verified_name && (
                <p className="text-sm text-muted-foreground">Account: {integration.verified_name}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Link to="/app/whatsapp">
                <Button variant="outline" size="sm">
                  <ChevronRight className="w-4 h-4 mr-1" />
                  Gestisci template
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
              >
                <Unlink className="w-4 h-4 mr-1" />
                Disconnetti
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Collega il tuo account WhatsApp Business per inviare automaticamente:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Conferme appuntamento</li>
              <li>Promemoria prima dell'appuntamento</li>
              <li>Notifiche di spostamento o cancellazione</li>
              <li>Follow-up dopo chiamate perse</li>
            </ul>
            <Button onClick={connect} disabled={connecting || loading}>
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connessione...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Connetti WhatsApp
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TwilioVoiceCard() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;

  const { data: settings, isLoading } = useQuery({
    queryKey: ["voice-settings", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("settings")
        .select("voice_enabled, voice_number, caller_id_e164, twilio_number_sid")
        .eq("tenant_id", tenantId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const isActive = settings?.voice_enabled && (!!settings?.caller_id_e164 || !!settings?.twilio_number_sid);
  const isEnabled = settings?.voice_enabled;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Phone className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Twilio Voice
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isActive ? (
                  <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                    <Check className="w-3 h-3 mr-1" />
                    Attivo
                  </Badge>
                ) : isEnabled ? (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Simulato
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    Disattivo
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Chiamate automatiche AI per contattare i lead
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isActive ? (
          <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm">
                Chiamate attive con: <strong>{settings?.caller_id_e164 || settings?.voice_number}</strong>
              </span>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Le chiamate AI vengono configurate nella sezione Impostazioni Integrazioni.
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Chiamate automatiche ai nuovi lead</li>
              <li>Retry intelligente con escalation WhatsApp</li>
              <li>Trascrizioni e recap delle chiamate</li>
            </ul>
          </>
        )}
        <Link to="/app/settings/integrations">
          <Button variant="outline" size="sm">
            <ChevronRight className="w-4 h-4 mr-1" />
            Configura Voice
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function ZoomCard() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;

  const { data: settings, isLoading } = useQuery({
    queryKey: ["zoom-settings", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("settings")
        .select("default_meeting_provider")
        .eq("tenant_id", tenantId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const isDefault = (settings as any)?.default_meeting_provider === "zoom";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Video className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Zoom
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isDefault ? (
                  <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                    <Check className="w-3 h-3 mr-1" />
                    Provider predefinito
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    Disponibile
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Crea meeting Zoom automaticamente per gli appuntamenti online
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Zoom è configurato dall'amministratore a livello di piattaforma. Puoi scegliere Zoom come provider predefinito nelle Impostazioni Integrazioni.
        </p>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li>Meeting Zoom creati automaticamente</li>
          <li>Link di partecipazione inseriti negli appuntamenti</li>
          <li>Sincronizzazione con Google Calendar (se collegato)</li>
        </ul>
        <Link to="/app/settings/integrations">
          <Button variant="outline" size="sm">
            <ChevronRight className="w-4 h-4 mr-1" />
            Configura provider meeting
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
