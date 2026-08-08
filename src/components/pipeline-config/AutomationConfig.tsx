import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Save, Loader2, Phone, MessageSquare, Clock, CalendarClock, XCircle, RefreshCw,
} from "lucide-react";

interface AutomationSettings {
  // Retry
  max_attempts: number;
  retry_after_hours: number;
  send_whatsapp_on_no_answer: boolean;
  retry_even_after_wa: boolean;
  // Schedule
  call_window_start: string;
  call_window_end: string;
  allow_weekends: boolean;
  // Callback
  callback_auto_schedule: boolean;
  // Appointment
  on_appointment_cancel: "to_call" | "nurturing" | "closed_lost";
  // Closure
  auto_close_after_days: number;
}

const defaultSettings: AutomationSettings = {
  max_attempts: 5,
  retry_after_hours: 4,
  send_whatsapp_on_no_answer: true,
  retry_even_after_wa: true,
  call_window_start: "09:00",
  call_window_end: "18:00",
  allow_weekends: false,
  callback_auto_schedule: true,
  on_appointment_cancel: "to_call",
  auto_close_after_days: 0,
};

export default function AutomationConfig() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const queryClient = useQueryClient();

  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ["automation-config", tenantId],
    queryFn: async () => {
      if (!tenantId) return defaultSettings;
      const { data, error } = await supabase
        .from("settings")
        .select("retry_config_json")
        .eq("tenant_id", tenantId)
        .single();
      if (error) throw error;
      const cfg = data?.retry_config_json as Record<string, unknown> | null;
      if (!cfg) return defaultSettings;
      return {
        max_attempts: (cfg.max_attempts as number) || defaultSettings.max_attempts,
        retry_after_hours: (cfg.retry_after_hours as number) || defaultSettings.retry_after_hours,
        send_whatsapp_on_no_answer: cfg.send_whatsapp_on_no_answer !== false,
        retry_even_after_wa: cfg.retry_even_after_wa !== false,
        call_window_start: (cfg.call_window_start as string) || defaultSettings.call_window_start,
        call_window_end: (cfg.call_window_end as string) || defaultSettings.call_window_end,
        allow_weekends: (cfg.allow_weekends as boolean) || false,
        callback_auto_schedule: cfg.callback_auto_schedule !== false,
        on_appointment_cancel: (cfg.on_appointment_cancel as string) || "to_call",
        auto_close_after_days: (cfg.auto_close_after_days as number) || 0,
      } as AutomationSettings;
    },
    enabled: !!tenantId,
  });

  const [config, setConfig] = useState<AutomationSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (savedConfig) {
      setConfig(savedConfig);
      setHasChanges(false);
    }
  }, [savedConfig]);

  const update = <K extends keyof AutomationSettings>(key: K, val: AutomationSettings[K]) => {
    setConfig(prev => ({ ...prev, [key]: val }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("settings")
        .update({ retry_config_json: config as any })
        .eq("tenant_id", tenantId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["automation-config", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["retry_config", tenantId] });
      setHasChanges(false);
      toast.success("Automazioni salvate");
    } catch (err: any) {
      toast.error(`Errore: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Voice retry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Tentativi di Chiamata
          </CardTitle>
          <CardDescription>
            Quante volte e quando il sistema deve riprovare a chiamare
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Massimo tentativi</Label>
              <span className="text-xl font-bold text-primary">{config.max_attempts}</span>
            </div>
            <Slider
              value={[config.max_attempts]}
              onValueChange={([v]) => update("max_attempts", v)}
              min={1} max={10} step={1}
            />
            <p className="text-xs text-muted-foreground">
              Dopo {config.max_attempts} tentativi senza risposta, il contatto viene chiuso come perso
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Ore tra un tentativo e l'altro</Label>
              <span className="text-xl font-bold text-primary">{config.retry_after_hours}h</span>
            </div>
            <Slider
              value={[config.retry_after_hours]}
              onValueChange={([v]) => update("retry_after_hours", v)}
              min={1} max={48} step={1}
            />
          </div>
        </CardContent>
      </Card>

      {/* Call window */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Orari di Chiamata
          </CardTitle>
          <CardDescription>
            Finestra oraria in cui il sistema può effettuare chiamate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Inizio</Label>
              <Input
                type="time"
                value={config.call_window_start}
                onChange={e => update("call_window_start", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fine</Label>
              <Input
                type="time"
                value={config.call_window_end}
                onChange={e => update("call_window_end", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Chiama nei weekend</Label>
              <p className="text-xs text-muted-foreground">Sabato e domenica inclusi</p>
            </div>
            <Switch
              checked={config.allow_weekends}
              onCheckedChange={v => update("allow_weekends", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp Follow-up
          </CardTitle>
          <CardDescription>
            Cosa fare con WhatsApp quando un contatto non risponde alla chiamata
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Invia WhatsApp su mancata risposta</Label>
              <p className="text-xs text-muted-foreground">
                Usa un template approvato per notificare il contatto
              </p>
            </div>
            <Switch
              checked={config.send_whatsapp_on_no_answer}
              onCheckedChange={v => update("send_whatsapp_on_no_answer", v)}
            />
          </div>

          {config.send_whatsapp_on_no_answer && (
            <div className="flex items-center justify-between">
              <div>
                <Label>Richiama comunque dopo WhatsApp</Label>
                <p className="text-xs text-muted-foreground">
                  La richiamata vocale prosegue anche se il messaggio è stato inviato
                </p>
              </div>
              <Switch
                checked={config.retry_even_after_wa}
                onCheckedChange={v => update("retry_even_after_wa", v)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Callback */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Callback
          </CardTitle>
          <CardDescription>
            Gestione delle richieste di richiamata (da voce o WhatsApp)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Programma richiamata automaticamente</Label>
              <p className="text-xs text-muted-foreground">
                Se il lead propone un orario preciso, il sistema lo schedula in automatico
              </p>
            </div>
            <Switch
              checked={config.callback_auto_schedule}
              onCheckedChange={v => update("callback_auto_schedule", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Appointment cancellation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            Cancellazione Appuntamento
          </CardTitle>
          <CardDescription>
            Cosa succede nel CRM quando un appuntamento viene cancellato
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Sposta contatto in</Label>
            <Select
              value={config.on_appointment_cancel}
              onValueChange={v => update("on_appointment_cancel", v as any)}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="to_call">Da richiamare</SelectItem>
                <SelectItem value="nurturing">Nurturing</SelectItem>
                <SelectItem value="closed_lost">Chiuso (Perso)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Il contatto verrà spostato in questo stadio dopo la cancellazione
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Auto-close */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Chiusura Automatica
          </CardTitle>
          <CardDescription>
            Chiudi automaticamente i contatti inattivi dopo un certo periodo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Giorni di inattività prima della chiusura</Label>
            <span className="text-xl font-bold text-primary">
              {config.auto_close_after_days === 0 ? "Disattivato" : `${config.auto_close_after_days}g`}
            </span>
          </div>
          <Slider
            value={[config.auto_close_after_days]}
            onValueChange={([v]) => update("auto_close_after_days", v)}
            min={0} max={90} step={1}
          />
          <p className="text-xs text-muted-foreground">
            {config.auto_close_after_days === 0
              ? "La chiusura automatica è disattivata. I contatti resteranno nello stadio corrente."
              : `Dopo ${config.auto_close_after_days} giorni senza attività, il contatto verrà spostato in "Chiuso (Perso)"`}
          </p>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          size="lg"
          className="gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salva Automazioni
        </Button>
      </div>
    </div>
  );
}
