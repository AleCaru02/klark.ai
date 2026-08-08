import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertCircle,
  Clock,
  Loader2,
  Pause,
  Phone,
  Play,
  Save,
  ShieldAlert,
  Volume2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceOption {
  id: string;
  name: string;
  gender: "F" | "M";
  description: string;
}

const voices: VoiceOption[] = [
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", gender: "F", description: "Professionale e misurata" },
  { id: "8KInRSd4DtD5L5gK7itu", name: "Giusy", gender: "F", description: "Calda e accogliente" },
  { id: "4YsN90HrCPrOCmBglwMA", name: "Marco", gender: "M", description: "Chiaro e professionale" },
  { id: "MTgv1KRJpUnc34UMGTHK", name: "Luca", gender: "M", description: "Calmo e rassicurante" },
];

type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

interface DayAvailability {
  start: string;
  end: string;
  enabled: boolean;
}

type Availability = Record<DayKey, DayAvailability>;

const defaultAvailability: Availability = {
  monday: { start: "09:00", end: "18:00", enabled: true },
  tuesday: { start: "09:00", end: "18:00", enabled: true },
  wednesday: { start: "09:00", end: "18:00", enabled: true },
  thursday: { start: "09:00", end: "18:00", enabled: true },
  friday: { start: "09:00", end: "18:00", enabled: true },
  saturday: { start: "09:00", end: "13:00", enabled: false },
  sunday: { start: "09:00", end: "13:00", enabled: false },
};

const daysOrder: { key: DayKey; label: string }[] = [
  { key: "monday", label: "Lunedì" },
  { key: "tuesday", label: "Martedì" },
  { key: "wednesday", label: "Mercoledì" },
  { key: "thursday", label: "Giovedì" },
  { key: "friday", label: "Venerdì" },
  { key: "saturday", label: "Sabato" },
  { key: "sunday", label: "Domenica" },
];

const hours = Array.from({ length: 34 }, (_, index) => {
  const minutes = 6 * 60 + index * 30;
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60)
    .toString()
    .padStart(2, "0")}`;
});

function normalizeAvailability(value: unknown): Availability {
  if (!value || typeof value !== "object") return defaultAvailability;
  const source = value as Record<string, unknown>;

  return daysOrder.reduce((result, { key }) => {
    const candidate = source[key] as Partial<DayAvailability> | undefined;
    result[key] = {
      start: typeof candidate?.start === "string" ? candidate.start : defaultAvailability[key].start,
      end: typeof candidate?.end === "string" ? candidate.end : defaultAvailability[key].end,
      enabled: typeof candidate?.enabled === "boolean" ? candidate.enabled : defaultAvailability[key].enabled,
    };
    return result;
  }, {} as Availability);
}

function availabilityToJson(value: Availability): Json {
  return Object.fromEntries(
    Object.entries(value).map(([key, day]) => [
      key,
      { start: day.start, end: day.end, enabled: day.enabled },
    ]),
  ) as Json;
}

export default function Secretary() {
  const { membership } = useAuth();
  const { toast } = useToast();
  const tenantId = membership?.tenant_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>(voices[0].id);
  const [greeting, setGreeting] = useState("Buongiorno, come posso aiutarla?");
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [availability, setAvailability] = useState<Availability>(defaultAvailability);
  const [promptConfiguration, setPromptConfiguration] = useState<Record<string, Json | undefined>>({});

  const invalidDays = useMemo(
    () => daysOrder.filter(({ key }) => availability[key].enabled && availability[key].start >= availability[key].end),
    [availability],
  );

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const fetchSettings = async () => {
    if (!tenantId) {
      setLoadError("Account non associato a un'organizzazione.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("voice_pack_id,recording_opt_in,availability_json,ai_prompt_json")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Configurazione tenant non inizializzata.");

      const prompt = (data.ai_prompt_json ?? {}) as Record<string, Json | undefined>;
      setPromptConfiguration(prompt);
      setGreeting(typeof prompt.greeting === "string" ? prompt.greeting : "Buongiorno, come posso aiutarla?");
      if (data.voice_pack_id && voices.some((voice) => voice.id === data.voice_pack_id)) {
        setSelectedVoice(data.voice_pack_id);
      }
      setRecordingEnabled(data.recording_opt_in === true);
      setAvailability(normalizeAvailability(data.availability_json));
    } catch (error) {
      console.error("Unable to load secretary settings");
      setLoadError(error instanceof Error ? error.message : "Impostazioni non disponibili.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, [tenantId]);

  const handleSave = async () => {
    if (!tenantId) return;
    if (!greeting.trim()) {
      toast({ title: "Saluto mancante", description: "Inserisci il messaggio iniziale.", variant: "destructive" });
      return;
    }
    if (invalidDays.length > 0) {
      toast({
        title: "Orari non validi",
        description: "L'orario di chiusura deve essere successivo a quello di apertura.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const nextPrompt: Json = {
        ...promptConfiguration,
        greeting: greeting.trim(),
      };
      const { data, error } = await supabase
        .from("settings")
        .update({
          voice_pack_id: selectedVoice,
          recording_opt_in: recordingEnabled,
          availability_json: availabilityToJson(availability),
          ai_prompt_json: nextPrompt,
        })
        .eq("tenant_id", tenantId)
        .select("tenant_id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Configurazione tenant non trovata.");

      setPromptConfiguration((current) => ({ ...current, greeting: greeting.trim() }));
      toast({
        title: "Impostazioni salvate",
        description: "Esegui il Test Center prima di usare la configurazione su chiamate reali.",
      });
    } catch {
      toast({
        title: "Salvataggio non riuscito",
        description: "Nessuna modifica viene considerata applicata.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateAvailability = <K extends keyof DayAvailability>(
    day: DayKey,
    field: K,
    value: DayAvailability[K],
  ) => {
    setAvailability((current) => ({
      ...current,
      [day]: { ...current[day], [field]: value },
    }));
  };

  const toggleLocalPreview = () => {
    if (!("speechSynthesis" in window)) {
      toast({
        title: "Anteprima non disponibile",
        description: "Il browser non supporta la sintesi vocale locale.",
        variant: "destructive",
      });
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const text = greeting.trim();
    if (!text) {
      toast({ title: "Saluto mancante", description: "Inserisci il testo da leggere.", variant: "destructive" });
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text.slice(0, 500));
    utterance.lang = "it-IT";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      toast({ title: "Anteprima interrotta", description: "Il browser non ha riprodotto il testo.", variant: "destructive" });
    };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Caricamento impostazioni segretaria</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="max-w-xl border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" aria-hidden="true" />
            Impostazioni non disponibili
          </CardTitle>
          <CardDescription>{loadError}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void fetchSettings()}>Riprova</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Impostazioni segretaria</h1>
        <p className="text-muted-foreground">
          Configura voce, saluto, disponibilità e consenso alla registrazione.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5" aria-hidden="true" />
              Voce configurata
            </CardTitle>
            <CardDescription>
              La selezione identifica la voce provider. L'anteprima locale legge solo il testo e non rappresenta la voce finale.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset className="grid gap-3">
              <legend className="sr-only">Seleziona voce</legend>
              {voices.map((voice) => {
                const selected = selectedVoice === voice.id;
                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => setSelectedVoice(voice.id)}
                    aria-pressed={selected}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          voice.gender === "M" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
                        }`}
                        aria-hidden="true"
                      >
                        {voice.name.charAt(0)}
                      </span>
                      <span>
                        <span className="block font-medium">{voice.name}</span>
                        <span className="block text-xs text-muted-foreground">{voice.description}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </fieldset>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" aria-hidden="true" />
                Messaggio iniziale
              </CardTitle>
              <CardDescription>Testo pronunciato all'inizio della chiamata.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="greeting">Saluto</Label>
                <Textarea
                  id="greeting"
                  value={greeting}
                  onChange={(event) => setGreeting(event.target.value)}
                  rows={4}
                  maxLength={500}
                  aria-describedby="greeting-help"
                />
                <p id="greeting-help" className="text-xs text-muted-foreground">
                  {greeting.length}/500 caratteri. Evita promesse, dati sensibili e informazioni non presenti nella knowledge base.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={toggleLocalPreview}>
                {speaking ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {speaking ? "Interrompi anteprima locale" : "Ascolta testo con voce del dispositivo"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" aria-hidden="true" />
                Orari operativi
              </CardTitle>
              <CardDescription>Fasce utilizzate dalle regole di disponibilità.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {daysOrder.map(({ key, label }) => {
                const day = availability[key];
                const invalid = day.enabled && day.start >= day.end;
                return (
                  <div
                    key={key}
                    className={`grid grid-cols-[minmax(110px,1fr)_1fr_auto_1fr] gap-2 items-center p-2 rounded-lg ${
                      !day.enabled ? "opacity-60 bg-muted/30" : invalid ? "bg-destructive/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`${key}-enabled`}
                        checked={day.enabled}
                        onCheckedChange={(checked) => updateAvailability(key, "enabled", checked)}
                      />
                      <Label htmlFor={`${key}-enabled`} className="text-sm">{label}</Label>
                    </div>
                    <Select
                      value={day.start}
                      onValueChange={(value) => updateAvailability(key, "start", value)}
                      disabled={!day.enabled}
                    >
                      <SelectTrigger aria-label={`Apertura ${label}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{hours.map((hour) => <SelectItem key={hour} value={hour}>{hour}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className="text-muted-foreground" aria-hidden="true">—</span>
                    <Select
                      value={day.end}
                      onValueChange={(value) => updateAvailability(key, "end", value)}
                      disabled={!day.enabled}
                    >
                      <SelectTrigger aria-label={`Chiusura ${label}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{hours.map((hour) => <SelectItem key={hour} value={hour}>{hour}</SelectItem>)}</SelectContent>
                    </Select>
                    {invalid && <p className="col-span-4 text-xs text-destructive">La chiusura deve essere successiva all'apertura.</p>}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" aria-hidden="true" />
                Registrazione e trascrizione
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="recording-enabled" className="font-medium">Consenti registrazione chiamate</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Attiva solo dopo aver definito informativa, base giuridica, annuncio iniziale, accessi e periodo di conservazione.
                  </p>
                </div>
                <Switch
                  id="recording-enabled"
                  checked={recordingEnabled}
                  onCheckedChange={setRecordingEnabled}
                />
              </div>
              {recordingEnabled && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  L'opzione tecnica non sostituisce la verifica legale e il Test Center. Le chiamate non devono essere registrate in produzione finché tali controlli non risultano completati.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => void handleSave()} disabled={saving || invalidDays.length > 0}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? "Salvataggio…" : "Salva impostazioni"}
        </Button>
      </div>
    </div>
  );
}
