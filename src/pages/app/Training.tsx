import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Save, Lightbulb, AlertTriangle, CheckCircle, Info, Eye, Loader2, BookOpen, Brain, RefreshCw, Phone, MessageSquare, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePromptSettings, AIPromptConfig } from "@/hooks/usePromptSettings";
import { KnowledgeUpload } from "@/components/training/KnowledgeUpload";
import { useRetryConfig, RetryConfig } from "@/hooks/useRetryConfig";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

interface PromptValidation {
  type: "warning" | "error" | "info";
  message: string;
}

const TONE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "formale", label: "Formale" },
  { value: "amichevole", label: "Amichevole" },
];

const FORMALITY_OPTIONS = [
  { value: "tu", label: "Tu (informale)" },
  { value: "lei", label: "Lei (formale)" },
];

const LANGUAGE_OPTIONS = [
  { value: "it", label: "Italiano" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
];

const SECTOR_OPTIONS = [
  "Studio Legale",
  "Studio Dentistico",
  "Commercialista",
  "Medico Specialista",
  "Fisioterapista",
  "Psicologo",
  "Consulente",
  "Altro",
];

const TOOL_LIST = [
  { id: "book_appointment", name: "Prenota appuntamento", description: "Permette di prenotare nuovi appuntamenti" },
  { id: "reschedule", name: "Sposta appuntamento", description: "Permette di spostare appuntamenti esistenti" },
  { id: "cancel", name: "Cancella appuntamento", description: "Permette di cancellare appuntamenti" },
  { id: "check_availability", name: "Verifica disponibilità", description: "Mostra slot liberi nel calendario" },
  { id: "get_info", name: "Informazioni studio", description: "Fornisce info su orari, servizi, indirizzo" },
];

export default function Training() {
  const { aiPrompt, isLoading, savePrompt, isSaving } = usePromptSettings();
  
  const { retryConfig, isLoading: retryLoading, updateConfig: updateRetryConfig } = useRetryConfig();
  
  const [activeTab, setActiveTab] = useState<"knowledge" | "prompt" | "retry">("knowledge");
  const [promptMode, setPromptMode] = useState<"simple" | "advanced">("simple");
  const [showHelper, setShowHelper] = useState(true);
  
  const [retryState, setRetryState] = useState<RetryConfig>({
    max_attempts: 5,
    retry_after_hours: 4,
    send_whatsapp_on_no_answer: true,
  });
  const [retryHasChanges, setRetryHasChanges] = useState(false);

  useEffect(() => {
    if (retryConfig) {
      setRetryState(retryConfig);
    }
  }, [retryConfig]);

  // Simple mode fields
  const [simpleConfig, setSimpleConfig] = useState({
    sector: "Studio Legale",
    description: "",
    faq: "",
    objections: "",
    forbiddenWords: "",
    tone: "standard",
    formality: "lei",
    languages: ["it"] as string[],
  });

  // Advanced mode fields
  const [advancedPrompt, setAdvancedPrompt] = useState("");
  const [enabledTools, setEnabledTools] = useState<string[]>(["book_appointment", "reschedule", "cancel", "check_availability", "get_info"]);

  // Load saved config
  useEffect(() => {
    if (aiPrompt) {
      setPromptMode(aiPrompt.mode);
      setSimpleConfig(aiPrompt.simple);
      setAdvancedPrompt(aiPrompt.advanced.prompt);
      setEnabledTools(aiPrompt.advanced.enabledTools);
    }
  }, [aiPrompt]);

  // Generate prompt from simple config
  const generatedPrompt = useMemo(() => {
    const toneText = TONE_OPTIONS.find(t => t.value === simpleConfig.tone)?.label || "Standard";
    const formalityText = simpleConfig.formality === "lei" ? "Dai del Lei" : "Dai del Tu";
    const langList = simpleConfig.languages.map(l => LANGUAGE_OPTIONS.find(o => o.value === l)?.label).join(", ");

    return `Sei l'assistente virtuale di un ${simpleConfig.sector}.

DESCRIZIONE ATTIVITÀ:
${simpleConfig.description || "[Inserisci descrizione]"}

TONO E STILE:
- Tono: ${toneText}
- Formalità: ${formalityText}
- Lingue supportate: ${langList || "Italiano"}

FAQ COMUNI:
${simpleConfig.faq || "[Inserisci FAQ]"}

GESTIONE OBIEZIONI:
${simpleConfig.objections || "[Inserisci gestione obiezioni]"}

PAROLE/FRASI VIETATE:
Non usare mai: ${simpleConfig.forbiddenWords || "[Nessuna]"}

REGOLE FONDAMENTALI:
- Non promettere mai risultati garantiti
- Non fornire consulenze professionali dirette
- Rimanda sempre al professionista per domande specifiche
- Gestisci solo prenotazioni, spostamenti e cancellazioni`;
  }, [simpleConfig]);

  // Validate advanced prompt
  const validations = useMemo((): PromptValidation[] => {
    const result: PromptValidation[] = [];
    const promptLower = advancedPrompt.toLowerCase();

    if (promptLower.includes("garantito") || promptLower.includes("garantiamo") || promptLower.includes("sicuro al 100%")) {
      result.push({ type: "error", message: "Il prompt contiene promesse impossibili (es. 'garantito', 'sicuro al 100%')" });
    }

    if (promptLower.includes("carta di credito") || promptLower.includes("codice fiscale") || promptLower.includes("password")) {
      result.push({ type: "error", message: "Il prompt potrebbe chiedere dati sensibili" });
    }

    if (promptLower.includes("disponibile sempre") || promptLower.includes("24/7")) {
      result.push({ type: "warning", message: "Verifica che la disponibilità indicata corrisponda agli orari effettivi" });
    }

    if (!promptLower.includes("orari") && !promptLower.includes("disponibilità") && advancedPrompt.length > 50) {
      result.push({ type: "info", message: "Considera di aggiungere informazioni sugli orari di apertura" });
    }

    if (advancedPrompt.length > 0 && advancedPrompt.length < 100) {
      result.push({ type: "warning", message: "Il prompt è molto corto. Aggiungi più dettagli per risultati migliori" });
    }

    if (advancedPrompt.length > 4000) {
      result.push({ type: "warning", message: "Il prompt è molto lungo. Considera di semplificarlo" });
    }

    return result;
  }, [advancedPrompt]);

  const toggleTool = (toolId: string) => {
    setEnabledTools(prev => 
      prev.includes(toolId) 
        ? prev.filter(t => t !== toolId)
        : [...prev, toolId]
    );
  };

  const toggleLanguage = (lang: string) => {
    setSimpleConfig(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang]
    }));
  };

  const handleSave = async () => {
    const config: AIPromptConfig = {
      mode: promptMode,
      simple: simpleConfig,
      advanced: {
        prompt: advancedPrompt,
        enabledTools,
      },
      generatedPrompt: promptMode === "simple" ? generatedPrompt : advancedPrompt,
    };
    await savePrompt(config);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Addestramento AI</h1>
          <p className="text-muted-foreground">
            Personalizza la conoscenza e il comportamento della tua segretaria AI
          </p>
        </div>
      </div>

      {/* AI Helper Banner */}
      {showHelper && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">AI Training Helper</h3>
                <p className="text-sm text-muted-foreground">
                  Addestra la tua AI caricando documenti e inserendo il tuo sito web. Più informazioni fornisci, più precisa sarà la segretaria nel rispondere ai tuoi clienti.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowHelper(false)}>
                Nascondi
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "knowledge" | "prompt" | "retry")}>
        <TabsList className="mb-6">
          <TabsTrigger value="knowledge">
            <BookOpen className="w-4 h-4 mr-2" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="prompt">
            <Sparkles className="w-4 h-4 mr-2" />
            Configurazione Prompt
          </TabsTrigger>
          <TabsTrigger value="retry">
            <RefreshCw className="w-4 h-4 mr-2" />
            Configurazione Retry
          </TabsTrigger>
        </TabsList>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge">
          <KnowledgeUpload />
        </TabsContent>

        {/* Prompt Configuration Tab */}
        <TabsContent value="prompt">
          <Tabs value={promptMode} onValueChange={(v) => setPromptMode(v as "simple" | "advanced")}>
            <TabsList className="mb-6">
              <TabsTrigger value="simple">
                <Lightbulb className="w-4 h-4 mr-2" />
                Modalità Semplice
              </TabsTrigger>
              <TabsTrigger value="advanced">
                <Sparkles className="w-4 h-4 mr-2" />
                Modalità Avanzata
              </TabsTrigger>
            </TabsList>

            {/* Simple Mode */}
            <TabsContent value="simple">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Configuration Form */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Configurazione Guidata</CardTitle>
                      <CardDescription>
                        Compila i campi e genereremo il prompt perfetto per te
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Sector */}
                      <div className="space-y-2">
                        <Label>Settore</Label>
                        <Select 
                          value={simpleConfig.sector} 
                          onValueChange={(v) => setSimpleConfig({...simpleConfig, sector: v})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SECTOR_OPTIONS.map(sector => (
                              <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <Label>Descrizione Attività</Label>
                        <Textarea
                          value={simpleConfig.description}
                          onChange={(e) => setSimpleConfig({...simpleConfig, description: e.target.value})}
                          placeholder="Descrivi brevemente la tua attività, servizi offerti e orari..."
                          rows={4}
                        />
                      </div>

                      {/* FAQ */}
                      <div className="space-y-2">
                        <Label>FAQ Comuni</Label>
                        <Textarea
                          value={simpleConfig.faq}
                          onChange={(e) => setSimpleConfig({...simpleConfig, faq: e.target.value})}
                          placeholder="Q: Domanda frequente?&#10;A: Risposta..."
                          rows={4}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">Formato: Q: Domanda / A: Risposta</p>
                      </div>

                      {/* Objections */}
                      <div className="space-y-2">
                        <Label>Gestione Obiezioni</Label>
                        <Textarea
                          value={simpleConfig.objections}
                          onChange={(e) => setSimpleConfig({...simpleConfig, objections: e.target.value})}
                          placeholder="Come gestire richieste di sconto, reclami, ecc."
                          rows={3}
                        />
                      </div>

                      {/* Forbidden Words */}
                      <div className="space-y-2">
                        <Label>Parole/Frasi Vietate</Label>
                        <Input
                          value={simpleConfig.forbiddenWords}
                          onChange={(e) => setSimpleConfig({...simpleConfig, forbiddenWords: e.target.value})}
                          placeholder="gratis, sconto, garantito..."
                        />
                        <p className="text-xs text-muted-foreground">Separate da virgola</p>
                      </div>

                      {/* Tone */}
                      <div className="space-y-2">
                        <Label>Tono</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {TONE_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={cn(
                                "p-3 rounded-xl border-2 text-sm font-medium transition-all",
                                simpleConfig.tone === option.value
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/30"
                              )}
                              onClick={() => setSimpleConfig({...simpleConfig, tone: option.value})}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Formality */}
                      <div className="space-y-2">
                        <Label>Formalità</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {FORMALITY_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={cn(
                                "p-3 rounded-xl border-2 text-sm font-medium transition-all",
                                simpleConfig.formality === option.value
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/30"
                              )}
                              onClick={() => setSimpleConfig({...simpleConfig, formality: option.value})}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Languages */}
                      <div className="space-y-2">
                        <Label>Lingue Supportate</Label>
                        <div className="flex flex-wrap gap-2">
                          {LANGUAGE_OPTIONS.map((lang) => (
                            <button
                              key={lang.value}
                              type="button"
                              className={cn(
                                "px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all",
                                simpleConfig.languages.includes(lang.value)
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/30"
                              )}
                              onClick={() => toggleLanguage(lang.value)}
                            >
                              {lang.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Generated Prompt Preview */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        Anteprima Prompt Generato
                      </CardTitle>
                      <CardDescription>
                        Questo è il prompt che verrà usato dalla segretaria AI
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted rounded-xl p-4 font-mono text-sm whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                        {generatedPrompt}
                      </div>
                    </CardContent>
                  </Card>

                  <Button className="w-full" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvataggio...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Salva Configurazione
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Advanced Mode */}
            <TabsContent value="advanced">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Prompt Editor */}
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Prompt Personalizzato</CardTitle>
                      <CardDescription>
                        Scrivi le istruzioni complete per la tua segretaria AI
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        value={advancedPrompt}
                        onChange={(e) => setAdvancedPrompt(e.target.value)}
                        className="font-mono text-sm min-h-[400px]"
                        placeholder="Inserisci il system prompt..."
                      />
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">
                          {advancedPrompt.length} caratteri
                        </p>
                        <Button onClick={handleSave} disabled={isSaving}>
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Salvataggio...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Salva
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Validations */}
                  {validations.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Validazione Automatica</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {validations.map((v, i) => (
                            <div
                              key={i}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-lg",
                                v.type === "error" && "bg-destructive/10 text-destructive",
                                v.type === "warning" && "bg-warning/10 text-warning-foreground",
                                v.type === "info" && "bg-primary/10 text-primary"
                              )}
                            >
                              {v.type === "error" && <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                              {v.type === "warning" && <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                              {v.type === "info" && <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                              <p className="text-sm">{v.message}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Tools Sidebar */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Strumenti AI</CardTitle>
                      <CardDescription>
                        Seleziona le funzionalità disponibili
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {TOOL_LIST.map((tool) => (
                          <button
                            key={tool.id}
                            type="button"
                            className={cn(
                              "w-full p-3 rounded-xl border-2 text-left transition-all",
                              enabledTools.includes(tool.id)
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/30"
                            )}
                            onClick={() => toggleTool(tool.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-5 h-5 rounded-md flex items-center justify-center",
                                enabledTools.includes(tool.id)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              )}>
                                {enabledTools.includes(tool.id) && <CheckCircle className="w-3 h-3" />}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{tool.name}</p>
                                <p className="text-xs text-muted-foreground">{tool.description}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>
        {/* Retry Configuration Tab */}
        <TabsContent value="retry">
          <div className="max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Tentativi di Chiamata
                </CardTitle>
                <CardDescription>
                  Configura quanti tentativi fare e ogni quanto riprovare
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Tentativi massimi: {retryState.max_attempts}</Label>
                  <Slider
                    value={[retryState.max_attempts]}
                    onValueChange={([v]) => { setRetryState(prev => ({ ...prev, max_attempts: v })); setRetryHasChanges(true); }}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">Numero massimo di chiamate per ogni lead</p>
                </div>

                <div className="space-y-3">
                  <Label>Riprova dopo: {retryState.retry_after_hours} ore</Label>
                  <Slider
                    value={[retryState.retry_after_hours]}
                    onValueChange={([v]) => { setRetryState(prev => ({ ...prev, retry_after_hours: v })); setRetryHasChanges(true); }}
                    min={1}
                    max={24}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">Ore di attesa tra un tentativo e l'altro</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  WhatsApp Automatico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Invia WhatsApp se non risponde</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dopo una chiamata senza risposta, invia un messaggio WhatsApp automatico
                    </p>
                  </div>
                  <Switch
                    checked={retryState.send_whatsapp_on_no_answer}
                    onCheckedChange={(checked) => { setRetryState(prev => ({ ...prev, send_whatsapp_on_no_answer: checked })); setRetryHasChanges(true); }}
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={async () => {
                await updateRetryConfig.mutateAsync(retryState);
                setRetryHasChanges(false);
              }}
              disabled={!retryHasChanges || retryLoading}
              className="w-full"
            >
              {retryLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salva Configurazione Retry
                </>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
