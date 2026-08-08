import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useRetryConfig, RetryConfig } from "@/hooks/useRetryConfig";
import { Save, Loader2, Phone, MessageSquare, Clock } from "lucide-react";

export default function RetrySettings() {
  const { retryConfig, isLoading, updateConfig } = useRetryConfig();
  
  const [config, setConfig] = useState<RetryConfig>({
    max_attempts: 5,
    retry_after_hours: 4,
    send_whatsapp_on_no_answer: true,
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (retryConfig) {
      setConfig(retryConfig);
    }
  }, [retryConfig]);

  const handleChange = (key: keyof RetryConfig, value: number | boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateConfig.mutate(config, {
      onSuccess: () => setHasChanges(false),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurazione Retry</h1>
        <p className="text-muted-foreground">
          Imposta come gestire le chiamate senza risposta
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Tentativi di Chiamata
          </CardTitle>
          <CardDescription>
            Configura quante volte il sistema deve riprovare a chiamare un contatto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Numero massimo tentativi</Label>
              <span className="text-2xl font-bold text-primary">{config.max_attempts}</span>
            </div>
            <Slider
              value={[config.max_attempts]}
              onValueChange={([value]) => handleChange("max_attempts", value)}
              min={1}
              max={10}
              step={1}
            />
            <p className="text-sm text-muted-foreground">
              Dopo {config.max_attempts} tentativi senza risposta, il contatto verrà segnato come "fallito"
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Intervallo tra Tentativi
          </CardTitle>
          <CardDescription>
            Quanto tempo aspettare prima di riprovare
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Ore tra un tentativo e l'altro</Label>
              <span className="text-2xl font-bold text-primary">{config.retry_after_hours}h</span>
            </div>
            <Slider
              value={[config.retry_after_hours]}
              onValueChange={([value]) => handleChange("retry_after_hours", value)}
              min={1}
              max={24}
              step={1}
            />
            <p className="text-sm text-muted-foreground">
              Se il contatto non risponde, il sistema riproverà dopo {config.retry_after_hours} ore 
              (rispettando gli orari di disponibilità)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp di Follow-up
          </CardTitle>
          <CardDescription>
            Invia un messaggio WhatsApp quando il contatto non risponde
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Invia messaggio su mancata risposta</Label>
              <p className="text-sm text-muted-foreground">
                Usa il template "Chiamata persa" per notificare il contatto
              </p>
            </div>
            <Switch
              checked={config.send_whatsapp_on_no_answer}
              onCheckedChange={(checked) => handleChange("send_whatsapp_on_no_answer", checked)}
            />
          </div>
          {config.send_whatsapp_on_no_answer && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Nota:</strong> Assicurati di avere un template WhatsApp di tipo 
                "missed_call" approvato per questa funzionalità.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || updateConfig.isPending}
          size="lg"
        >
          {updateConfig.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salva Configurazione
        </Button>
      </div>
    </div>
  );
}
