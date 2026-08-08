import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, MessageCircle, Calendar, Loader2, Save, AlertCircle, CheckCircle2, XCircle, ExternalLink, Video } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface SettingsData {
  voice_enabled: boolean;
  whatsapp_enabled: boolean;
  calendar_enabled: boolean;
  voice_number: string | null;
  caller_id_e164: string | null;
  twilio_number_sid: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_display_number: string | null;
  calendar_id: string | null;
  default_meeting_provider: string | null;
}

export default function IntegrationSettings() {
  const { membership } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [zoomConnected, setZoomConnected] = useState(false);
  const [settings, setSettings] = useState<SettingsData>({
    voice_enabled: false,
    whatsapp_enabled: false,
    calendar_enabled: false,
    voice_number: null,
    caller_id_e164: null,
    twilio_number_sid: null,
    whatsapp_phone_number_id: null,
    whatsapp_display_number: null,
    calendar_id: null,
    default_meeting_provider: null,
  });

  const tenantId = membership?.tenant_id;

  useEffect(() => {
    if (tenantId) {
      fetchSettings();
    }
  }, [tenantId]);

  const fetchSettings = async () => {
    if (!tenantId) return;

    try {
      // Fetch settings
      const { data, error } = await supabase
        .from("settings")
        .select("voice_enabled, whatsapp_enabled, calendar_enabled, voice_number, caller_id_e164, twilio_number_sid, whatsapp_phone_number_id, whatsapp_display_number, calendar_id, default_meeting_provider")
        .eq("tenant_id", tenantId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setSettings({
          voice_enabled: data.voice_enabled || false,
          whatsapp_enabled: data.whatsapp_enabled || false,
          calendar_enabled: data.calendar_enabled || false,
          voice_number: data.voice_number,
          caller_id_e164: data.caller_id_e164,
          twilio_number_sid: data.twilio_number_sid,
          whatsapp_phone_number_id: data.whatsapp_phone_number_id,
          whatsapp_display_number: data.whatsapp_display_number,
          calendar_id: data.calendar_id,
          default_meeting_provider: (data as any).default_meeting_provider || null,
        });
      }

      // Check Google Calendar connection status
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.access_token) {
        try {
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
          setGoogleConnected(result.connected === true);
        } catch (e) {
          console.error("Error checking Google connection:", e);
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Errore nel caricamento delle impostazioni");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("settings")
        .upsert({
          tenant_id: tenantId,
          voice_enabled: settings.voice_enabled,
          whatsapp_enabled: settings.whatsapp_enabled,
          calendar_enabled: settings.calendar_enabled,
          voice_number: settings.voice_number,
          caller_id_e164: settings.caller_id_e164,
          twilio_number_sid: settings.twilio_number_sid,
          whatsapp_phone_number_id: settings.whatsapp_phone_number_id,
          whatsapp_display_number: settings.whatsapp_display_number,
          default_meeting_provider: settings.default_meeting_provider,
          updated_at: new Date().toISOString(),
        } as any, {
          onConflict: "tenant_id",
        });

      if (error) throw error;

      toast.success("Impostazioni salvate");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  // Voice is active if caller_id_e164 OR twilio_number_sid is configured
  // Voice is active if caller_id_e164 OR twilio_number_sid is configured
  const hasVoiceConfig = !!settings.caller_id_e164 || !!settings.twilio_number_sid;

  const getStatusBadge = (enabled: boolean, hasConfig: boolean) => {
    if (!enabled) {
      return (
        <Badge variant="secondary" className="gap-1">
          <XCircle className="w-3 h-3" />
          Disattivo
        </Badge>
      );
    }
    if (hasConfig) {
      return (
        <Badge variant="default" className="gap-1 bg-green-500 hover:bg-green-600">
          <CheckCircle2 className="w-3 h-3" />
          Attivo
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-400">
        <AlertCircle className="w-3 h-3" />
        Simulato
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1">Impostazioni Integrazioni</h1>
        <p className="text-muted-foreground">
          Configura le integrazioni Voice, WhatsApp e Calendar
        </p>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stato Integrazioni</CardTitle>
          <CardDescription>
            Panoramica delle integrazioni attive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium">Voice</span>
              </div>
              {getStatusBadge(settings.voice_enabled, hasVoiceConfig)}
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-green-500" />
                </div>
                <span className="font-medium">WhatsApp</span>
              </div>
              {getStatusBadge(settings.whatsapp_enabled, !!settings.whatsapp_phone_number_id)}
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-500" />
                </div>
                <span className="font-medium">Calendar</span>
              </div>
              {getStatusBadge(settings.calendar_enabled, googleConnected)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voice Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Phone className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Voice (Twilio)</CardTitle>
                <CardDescription>
                  Chiamate automatiche AI
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.voice_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, voice_enabled: checked })}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.voice_enabled && (
            <>
              <Separator />
              
              {/* Caller ID - Primary option */}
              <div className="space-y-2">
                <Label htmlFor="caller_id_e164">Caller ID verificato (Numero personale)</Label>
                <Input
                  id="caller_id_e164"
                  value={settings.caller_id_e164 || ""}
                  onChange={(e) => setSettings({ ...settings, caller_id_e164: e.target.value })}
                  placeholder="+39 333 123 4567"
                />
                <p className="text-xs text-muted-foreground">
                  Il tuo numero verificato su Twilio. Verrà usato come mittente per le chiamate in uscita.
                </p>
              </div>

              {/* Divider with OR */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">oppure</span>
                </div>
              </div>

              {/* Twilio Number - Optional */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="voice_number">Numero Twilio acquistato</Label>
                  <Input
                    id="voice_number"
                    value={settings.voice_number || ""}
                    onChange={(e) => setSettings({ ...settings, voice_number: e.target.value })}
                    placeholder="+39 02 1234 5678"
                  />
                  <p className="text-xs text-muted-foreground">
                    Solo se hai acquistato un numero Twilio dedicato
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twilio_sid">Twilio Number SID (opzionale)</Label>
                  <Input
                    id="twilio_sid"
                    value={settings.twilio_number_sid || ""}
                    onChange={(e) => setSettings({ ...settings, twilio_number_sid: e.target.value })}
                    placeholder="PN..."
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Richiesto solo per numeri Twilio acquistati
                  </p>
                </div>
              </div>

              {/* Status indicator */}
              {hasVoiceConfig ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-700">
                    Chiamate attive con: {settings.caller_id_e164 || settings.voice_number || "Numero configurato"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700">
                    Configura un Caller ID o un numero Twilio per effettuare chiamate
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-lg">WhatsApp Business</CardTitle>
                <CardDescription>
                  Messaggi automatici WhatsApp
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.whatsapp_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, whatsapp_enabled: checked })}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.whatsapp_enabled && (
            <>
              <Separator />
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wa_display">Numero WhatsApp</Label>
                  <Input
                    id="wa_display"
                    value={settings.whatsapp_display_number || ""}
                    onChange={(e) => setSettings({ ...settings, whatsapp_display_number: e.target.value })}
                    placeholder="+39 333 123 4567"
                  />
                  <p className="text-xs text-muted-foreground">
                    Numero visibile ai clienti
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wa_phone_id">Phone Number ID</Label>
                  <Input
                    id="wa_phone_id"
                    value={settings.whatsapp_phone_number_id || ""}
                    onChange={(e) => setSettings({ ...settings, whatsapp_phone_number_id: e.target.value })}
                    placeholder="123456789012345"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    ID del numero Meta Business
                  </p>
                </div>
              </div>
              {!settings.whatsapp_phone_number_id && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700">
                    Modalità simulata: i messaggi non verranno inviati realmente
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Calendar Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Google Calendar</CardTitle>
                <CardDescription>
                  Sincronizzazione appuntamenti
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.calendar_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, calendar_enabled: checked })}
            />
          </div>
        </CardHeader>
        <CardContent>
          {settings.calendar_enabled && (
            <>
              <Separator className="mb-4" />
              {googleConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700">
                      Google Calendar connesso{settings.calendar_id ? ` - ${settings.calendar_id}` : ""}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/app/integrations">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Gestisci connessione
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm text-yellow-700">
                      Google Calendar non ancora connesso
                    </span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/app/integrations">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Connetti Google Calendar
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Meeting Provider Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Video className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Provider Meeting</CardTitle>
              <CardDescription>
                Scegli quale piattaforma usare per gli appuntamenti online
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Separator />
          <div className="space-y-3">
            <Label>Provider predefinito per appuntamenti online</Label>
            <Select
              value={settings.default_meeting_provider || "auto"}
              onValueChange={(v) => setSettings({ ...settings, default_meeting_provider: v === "auto" ? null : v })}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Automatico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatico</SelectItem>
                <SelectItem value="google_meet">Google Meet</SelectItem>
                <SelectItem value="zoom">Zoom</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se "Automatico", il sistema userà il provider disponibile. Se entrambi sono collegati, verrà preferito Google Meet.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${googleConnected ? "border-green-500/30 bg-green-500/5" : "border-border bg-muted/30"}`}>
              <CheckCircle2 className={`w-4 h-4 ${googleConnected ? "text-green-600" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-medium">Google Meet</p>
                <p className="text-xs text-muted-foreground">
                  {googleConnected ? "Disponibile (via Google Calendar)" : "Non collegato"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Zoom</p>
                <p className="text-xs text-muted-foreground">
                  Configurazione gestita dall'amministratore
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvataggio...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salva Impostazioni
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
