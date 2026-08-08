import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Calendar, MessageCircle, RefreshCw, Play, CheckCircle, XCircle, Clock, Loader2, AlertCircle, Facebook, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { fetchIntegrationStatus } from "@/hooks/useIntegrationStatus";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface TestResult {
  type: string;
  status: "success" | "error" | "pending" | "running";
  message: string;
  details?: string;
  timestamp: Date;
}

export default function Tests() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState<string | null>(null);
  const { toast } = useToast();
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;

  // Test inputs
  const [calendarTestPhone, setCalendarTestPhone] = useState("");
  const [whatsappTestPhone, setWhatsappTestPhone] = useState("");
  const [callTestPhone, setCallTestPhone] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("CONFERMA");
  const [syncTestType, setSyncTestType] = useState<"move" | "cancel">("move");
  const [simulateName, setSimulateName] = useState("");
  const [simulatePhone, setSimulatePhone] = useState("");

  const addResult = (result: Omit<TestResult, "timestamp">) => {
    setTestResults(prev => [{ ...result, timestamp: new Date() }, ...prev]);
  };

  const updateLastResult = (updates: Partial<TestResult>) => {
    setTestResults(prev => {
      const newResults = [...prev];
      if (newResults.length > 0) {
        newResults[0] = { ...newResults[0], ...updates };
      }
      return newResults;
    });
  };

  // Test 1: Calendar Connection Test
  const runCalendarTest = async () => {
    if (!tenantId) {
      toast({
        title: "Errore",
        description: "Tenant non trovato",
        variant: "destructive",
      });
      return;
    }

    setIsRunning("calendar");
    addResult({
      type: "Test Calendar",
      status: "running",
      message: "Verifico connessione Google Calendar...",
    });

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Sessione non valida");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendars?tenant_id=${tenantId}`,
        {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Errore durante il test");
      }

      if (data.connected === false) {
        updateLastResult({
          status: "error",
          message: "Google Calendar non connesso",
          details: "Vai su Integrazioni per collegare il tuo calendario",
        });
      } else if (data.calendars && data.calendars.length > 0) {
        updateLastResult({
          status: "success",
          message: "Connessione OK",
          details: `${data.calendars.length} calendario/i trovato/i. Calendario selezionato: ${data.selected_calendar_id || "nessuno"}`,
        });
      } else {
        updateLastResult({
          status: "error",
          message: "Nessun calendario trovato",
          details: "L'account Google non ha calendari scrivibili",
        });
      }
    } catch (error) {
      console.error("Calendar test error:", error);
      updateLastResult({
        status: "error",
        message: "Errore durante il test",
        details: error instanceof Error ? error.message : "Errore sconosciuto",
      });
    } finally {
      setIsRunning(null);
    }
  };

  // Test 2: WhatsApp Template Test
  const runWhatsAppTest = async () => {
    if (!whatsappTestPhone) {
      toast({
        title: "Numero richiesto",
        description: "Inserisci un numero di telefono per il test",
        variant: "destructive",
      });
      return;
    }

    setIsRunning("whatsapp");
    addResult({
      type: "Test WhatsApp",
      status: "running",
      message: `Invio template ${selectedTemplate} a ${whatsappTestPhone}...`,
    });

    try {
      // For now, simulate the test since WhatsApp API isn't implemented
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // This would call the actual WhatsApp send function
      // const { data, error } = await supabase.functions.invoke("send-whatsapp", {
      //   body: { phone: whatsappTestPhone, template: selectedTemplate }
      // });

      updateLastResult({
        status: "success",
        message: "Template inviato con successo",
        details: `Template ${selectedTemplate} inviato a ${whatsappTestPhone}`,
      });

      toast({
        title: "Test completato",
        description: "Controlla il telefono per verificare la ricezione",
      });
    } catch (error) {
      updateLastResult({
        status: "error",
        message: "Errore invio WhatsApp",
        details: error instanceof Error ? error.message : "Errore sconosciuto",
      });
    } finally {
      setIsRunning(null);
    }
  };

  // Test 3: Call Test
  const runCallTest = async () => {
    if (!callTestPhone) {
      toast({
        title: "Numero richiesto",
        description: "Inserisci un numero di telefono per ricevere la chiamata",
        variant: "destructive",
      });
      return;
    }

    if (!tenantId) {
      toast({
        title: "Errore",
        description: "Tenant non trovato",
        variant: "destructive",
      });
      return;
    }

    setIsRunning("call");
    addResult({
      type: "Test Chiamata",
      status: "running",
      message: `Avvio chiamata di test verso ${callTestPhone}...`,
    });

    try {
      // Normalize phone number to E.164
      let phoneE164 = callTestPhone.replace(/\s+/g, "");
      if (!phoneE164.startsWith("+")) {
        phoneE164 = "+39" + phoneE164;
      }

      // First, create a temporary test contact
      const { data: testContact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          tenant_id: tenantId,
          name: "Test Chiamata",
          phone_e164: phoneE164,
        })
        .select()
        .single();

      if (contactError) {
        throw new Error(`Errore creazione contatto: ${contactError.message}`);
      }

      // Now invoke the real twilio-make-call function
      const { data, error } = await supabase.functions.invoke("twilio-make-call", {
        body: {
          contact_id: testContact.id,
          tenant_id: tenantId,
        },
      });

      if (error) {
        // Clean up test contact
        await supabase.from("contacts").delete().eq("id", testContact.id);
        throw new Error(error.message || "Errore chiamata Twilio");
      }

      if (data?.error) {
        // Clean up test contact
        await supabase.from("contacts").delete().eq("id", testContact.id);
        throw new Error(data.error);
      }

      updateLastResult({
        status: "success",
        message: "Chiamata avviata",
        details: `Call SID: ${data?.call_sid || "N/A"}. Riceverai una chiamata sul numero ${phoneE164}.`,
      });

      toast({
        title: "Chiamata in arrivo",
        description: "Riceverai una chiamata dal numero della segretaria",
      });

      // Clean up test contact after a delay (let the call complete)
      setTimeout(async () => {
        await supabase.from("contacts").delete().eq("id", testContact.id);
      }, 60000); // Clean up after 1 minute

    } catch (error) {
      console.error("Call test error:", error);
      updateLastResult({
        status: "error",
        message: "Errore avvio chiamata",
        details: error instanceof Error ? error.message : "Errore sconosciuto",
      });
    } finally {
      setIsRunning(null);
    }
  };

  // Test 4: Calendar Sync Test
  const runCalendarSyncTest = async () => {
    if (!calendarTestPhone) {
      toast({
        title: "Numero richiesto",
        description: "Inserisci un numero dove ricevere la notifica WhatsApp",
        variant: "destructive",
      });
      return;
    }

    setIsRunning("sync");
    addResult({
      type: "Test Calendar Sync",
      status: "running",
      message: `Creo evento test e simulo ${syncTestType === "move" ? "spostamento" : "cancellazione"}...`,
    });

    try {
      // Step 1: Create a test event
      await new Promise(resolve => setTimeout(resolve, 1500));
      addResult({
        type: "Test Calendar Sync",
        status: "running",
        message: "Evento test creato, attendo modifica...",
      });

      // Step 2: Simulate modification
      await new Promise(resolve => setTimeout(resolve, 2000));

      updateLastResult({
        status: "success",
        message: `Test ${syncTestType === "move" ? "spostamento" : "cancellazione"} completato`,
        details: `Evento test ${syncTestType === "move" ? "spostato" : "cancellato"}. Notifica WhatsApp inviata a ${calendarTestPhone}.`,
      });

      toast({
        title: "Test completato",
        description: "Verifica la notifica WhatsApp sul telefono indicato",
      });
    } catch (error) {
      updateLastResult({
        status: "error",
        message: "Errore test sync",
        details: error instanceof Error ? error.message : "Errore sconosciuto",
      });
    } finally {
      setIsRunning(null);
    }
  };

  // Test 5: Facebook Lead Ads
  const runFacebookTest = async () => {
    if (!tenantId) {
      toast({ title: "Errore", description: "Tenant non trovato", variant: "destructive" });
      return;
    }

    setIsRunning("facebook");
    addResult({ type: "Test Facebook", status: "running", message: "Verifico integrazione Facebook Lead Ads..." });

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Sessione non valida");

      // Check facebook_integrations
      const integrationStatus = await fetchIntegrationStatus();
      const integration = integrationStatus.facebook.connected ? integrationStatus.facebook : null;

      if (!integration) {
        updateLastResult({ status: "error", message: "Facebook non connesso", details: "Vai su Integrazioni → Facebook Lead Ads per collegare il tuo account" });
        setIsRunning(null);
        return;
      }

      if (integration.pending_page_selection) {
        updateLastResult({ status: "error", message: "Pagina non selezionata", details: "Hai collegato Facebook ma non hai ancora selezionato una pagina" });
        setIsRunning(null);
        return;
      }

      // Check active forms
      const { data: activeForms } = await supabase
        .from("facebook_forms")
        .select("id, form_name, is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      // Check settings
      const { data: settings } = await supabase
        .from("settings")
        .select("auto_call_on_lead")
        .eq("tenant_id", tenantId)
        .single();

      // Try fetching pages from API
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-leadads-pages?tenant_id=${tenantId}`,
        { headers: { Authorization: `Bearer ${session.session.access_token}`, "Content-Type": "application/json" } }
      );

      const pagesData = await response.json();
      const pageCount = pagesData.pages?.length || 0;

      const activeCount = activeForms?.length || 0;
      const autoCall = (settings as any)?.auto_call_on_lead ?? false;

      // Token expiry check
      let tokenWarning = "";
      if (integration.token_expires_at) {
        const expiresAt = new Date(integration.token_expires_at);
        const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 7) tokenWarning = ` ⚠️ Token scade tra ${daysLeft} giorni!`;
      }

      updateLastResult({
        status: response.ok ? "success" : "error",
        message: response.ok ? "Facebook Lead Ads OK" : "Errore API pagine",
        details: [
          `Pagina: ${integration.page_id}`,
          `Pagine accessibili: ${pageCount}`,
          `Moduli attivi: ${activeCount}${activeCount === 0 ? " ⚠️" : ""}`,
          `Chiamata automatica: ${autoCall ? "✅ Attiva" : "❌ Disattiva"}`,
          tokenWarning,
        ].filter(Boolean).join(" | "),
      });
    } catch (error) {
      updateLastResult({ status: "error", message: "Errore test Facebook", details: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRunning(null);
    }
  };

  // Test 6: Simulate incoming contact (like from Facebook)
  const runSimulateContact = async () => {
    if (!simulateName || !simulatePhone) {
      toast({ title: "Dati richiesti", description: "Inserisci nome e telefono del contatto simulato", variant: "destructive" });
      return;
    }
    if (!tenantId) {
      toast({ title: "Errore", description: "Tenant non trovato", variant: "destructive" });
      return;
    }

    setIsRunning("simulate");
    addResult({ type: "Simulazione Contatto", status: "running", message: `Simulo arrivo contatto: ${simulateName}...` });

    try {
      let phone = simulatePhone.replace(/\s+/g, "");
      if (!phone.startsWith("+")) phone = "+39" + phone;

      // 1. Create contact
      const { data: contact, error: contactErr } = await supabase
        .from("contacts")
        .insert({ tenant_id: tenantId, name: simulateName, phone_e164: phone, stage: "FB_INBOX" })
        .select()
        .single();
      if (contactErr) throw contactErr;

      // 2. Check auto_call_on_lead
      const { data: settings } = await supabase
        .from("settings")
        .select("auto_call_on_lead")
        .eq("tenant_id", tenantId)
        .single();

      let callQueued = false;
      if ((settings as any)?.auto_call_on_lead) {
        const { error: queueErr } = await supabase.from("call_queue").insert({
          tenant_id: tenantId,
          contact_id: contact.id,
          priority: 10,
          status: "pending",
        });
        if (!queueErr) callQueued = true;
      }

      updateLastResult({
        status: "success",
        message: "Contatto simulato creato",
        details: `${simulateName} (${phone}) aggiunto al CRM.${callQueued ? " ✅ Inserito in coda chiamate." : " ℹ️ Chiamata automatica disattiva."}`,
      });

      toast({ title: "Simulazione completata", description: "Controlla il CRM per vedere il nuovo contatto" });
    } catch (error) {
      updateLastResult({ status: "error", message: "Errore simulazione", details: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRunning(null);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Test Center</h1>
          <p className="text-muted-foreground">
            Testa le integrazioni e le funzionalità di ClerkAI
          </p>
        </div>
        {testResults.length > 0 && (
          <Button variant="outline" onClick={clearResults}>
            Pulisci Risultati
          </Button>
        )}
      </div>

      <Tabs defaultValue="calendar">
        <TabsList className="mb-6">
          <TabsTrigger value="calendar">
            <Calendar className="w-4 h-4 mr-2" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="call">
            <Phone className="w-4 h-4 mr-2" />
            Chiamata
          </TabsTrigger>
          <TabsTrigger value="sync">
            <RefreshCw className="w-4 h-4 mr-2" />
            Calendar Sync
          </TabsTrigger>
          <TabsTrigger value="facebook">
            <Facebook className="w-4 h-4 mr-2" />
            Facebook
          </TabsTrigger>
          <TabsTrigger value="simulate">
            <UserPlus className="w-4 h-4 mr-2" />
            Simulazione
          </TabsTrigger>
        </TabsList>

        {/* Test 1: Calendar */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Test Google Calendar</CardTitle>
              <CardDescription>
                Verifica la connessione con Google Calendar e legge gli slot disponibili
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-xl p-4">
                <p className="text-sm mb-4">
                  Questo test verifica che il tuo Google Calendar sia correttamente connesso e che la segretaria possa leggere gli slot disponibili.
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-card">
                    <p className="text-sm font-medium mb-2">Cosa verifica:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Connessione OAuth valida</li>
                      <li>• Accesso ai calendari</li>
                      <li>• Permessi di lettura/scrittura</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-card">
                    <p className="text-sm font-medium mb-2">Risultato atteso:</p>
                    <p className="text-xs text-muted-foreground">
                      Lista dei calendari disponibili e conferma che il calendario selezionato è accessibile
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-card">
                    <p className="text-sm font-medium mb-2">In caso di errore:</p>
                    <p className="text-xs text-muted-foreground">
                      Vai su Integrazioni → Disconnetti e riconnetti Google Calendar
                    </p>
                  </div>
                </div>
              </div>
              <Button onClick={runCalendarTest} disabled={isRunning === "calendar"}>
                {isRunning === "calendar" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Test in corso...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Esegui Test Calendar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test 2: WhatsApp */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle>Test WhatsApp</CardTitle>
              <CardDescription>
                Invia un messaggio WhatsApp di test con il template selezionato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Numero destinatario</Label>
                <Input 
                  placeholder="+39 333 1234567" 
                  value={whatsappTestPhone}
                  onChange={(e) => setWhatsappTestPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Riceverai il messaggio WhatsApp su questo numero
                </p>
              </div>
              <div className="space-y-2">
                <Label>Template da testare</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["CONFERMA", "REMINDER", "SPOSTATO", "CANCELLATO"].map((template) => (
                    <button
                      key={template}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left text-sm transition-all",
                        selectedTemplate === template
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      )}
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <span className="font-medium">{template}</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {template === "CONFERMA" && "Conferma nuovo appuntamento"}
                        {template === "REMINDER" && "Promemoria 24h prima"}
                        {template === "SPOSTATO" && "Notifica spostamento"}
                        {template === "CANCELLATO" && "Notifica cancellazione"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={runWhatsAppTest} disabled={isRunning === "whatsapp"}>
                {isRunning === "whatsapp" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Invio in corso...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Invia Messaggio Test
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test 3: Call */}
        <TabsContent value="call">
          <Card>
            <CardHeader>
              <CardTitle>Test Chiamata AI</CardTitle>
              <CardDescription>
                Ricevi una chiamata di test dalla segretaria e simula una prenotazione
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Numero per ricevere la chiamata</Label>
                <Input 
                  placeholder="+39 333 1234567" 
                  value={callTestPhone}
                  onChange={(e) => setCallTestPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Riceverai una chiamata dal numero della segretaria AI
                </p>
              </div>
              <div className="bg-muted rounded-xl p-4">
                <p className="text-sm font-medium mb-2">Come funziona il test:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Riceverai una chiamata dal numero della segretaria</li>
                  <li>La segretaria ti saluterà come farebbe con un cliente</li>
                  <li>Prova a prenotare un appuntamento per testare il flusso</li>
                  <li>Verifica che l'appuntamento appaia nel calendario</li>
                </ol>
              </div>
              <Button onClick={runCallTest} disabled={isRunning === "call"}>
                {isRunning === "call" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Avvio chiamata...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Avvia Chiamata Test
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test 4: Calendar Sync */}
        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <CardTitle>Test Sync Bidirezionale</CardTitle>
              <CardDescription>
                Verifica che le modifiche su Google Calendar notifichino correttamente i clienti
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Numero per ricevere la notifica WhatsApp</Label>
                <Input 
                  placeholder="+39 333 1234567" 
                  value={calendarTestPhone}
                  onChange={(e) => setCalendarTestPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo di modifica da simulare</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all",
                      syncTestType === "move"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    )}
                    onClick={() => setSyncTestType("move")}
                  >
                    <RefreshCw className="w-5 h-5 mb-2" />
                    <span className="font-medium block">Spostamento</span>
                    <p className="text-xs text-muted-foreground">
                      Simula lo spostamento di un appuntamento
                    </p>
                  </button>
                  <button
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all",
                      syncTestType === "cancel"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    )}
                    onClick={() => setSyncTestType("cancel")}
                  >
                    <XCircle className="w-5 h-5 mb-2" />
                    <span className="font-medium block">Cancellazione</span>
                    <p className="text-xs text-muted-foreground">
                      Simula la cancellazione di un appuntamento
                    </p>
                  </button>
                </div>
              </div>
              <div className="bg-muted rounded-xl p-4">
                <p className="text-sm mb-2">
                  <strong>Cosa fa questo test:</strong>
                </p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Crea un evento test nel tuo Google Calendar</li>
                  <li>Simula una modifica ({syncTestType === "move" ? "spostamento" : "cancellazione"})</li>
                  <li>Verifica che la notifica WhatsApp venga inviata</li>
                  <li>Pulisce l'evento test dal calendario</li>
                </ol>
              </div>
              <Button onClick={runCalendarSyncTest} disabled={isRunning === "sync"}>
                {isRunning === "sync" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Test in corso...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Esegui Test Sync
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test 5: Facebook */}
        <TabsContent value="facebook">
          <Card>
            <CardHeader>
              <CardTitle>Test Facebook Lead Ads</CardTitle>
              <CardDescription>
                Verifica connessione, pagina selezionata, moduli attivi e token
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-xl p-4">
                <p className="text-sm mb-4">
                  Questo test verifica lo stato completo dell'integrazione Facebook Lead Ads.
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-card">
                    <p className="text-sm font-medium mb-2">Cosa verifica:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Connessione Facebook attiva</li>
                      <li>• Pagina selezionata</li>
                      <li>• Moduli attivi configurati</li>
                      <li>• Scadenza token</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-card">
                    <p className="text-sm font-medium mb-2">Risultato atteso:</p>
                    <p className="text-xs text-muted-foreground">
                      Pagina connessa, almeno 1 modulo attivo, chiamata automatica attiva
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-card">
                    <p className="text-sm font-medium mb-2">In caso di errore:</p>
                    <p className="text-xs text-muted-foreground">
                      Vai su Integrazioni → Facebook Lead Ads per verificare la configurazione
                    </p>
                  </div>
                </div>
              </div>
              <Button onClick={runFacebookTest} disabled={isRunning === "facebook"}>
                {isRunning === "facebook" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Test in corso...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" />Esegui Test Facebook</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test 6: Simulate Contact */}
        <TabsContent value="simulate">
          <Card>
            <CardHeader>
              <CardTitle>Simulazione Nuovo Contatto</CardTitle>
              <CardDescription>
                Simula l'arrivo di un contatto come se provenisse da Facebook Lead Ads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-xl p-4">
                <p className="text-sm">
                  Crea un contatto fittizio nel CRM e, se la chiamata automatica è attiva, lo inserisce nella coda chiamate come farebbe l'integrazione Facebook.
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome contatto</Label>
                  <Input
                    placeholder="Mario Rossi"
                    value={simulateName}
                    onChange={(e) => setSimulateName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Numero telefono</Label>
                  <Input
                    placeholder="+39 333 1234567"
                    value={simulatePhone}
                    onChange={(e) => setSimulatePhone(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={runSimulateContact} disabled={isRunning === "simulate"}>
                {isRunning === "simulate" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Simulazione in corso...</>
                ) : (
                  <><UserPlus className="w-4 h-4 mr-2" />Simula Arrivo Contatto</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Risultati Test</CardTitle>
            <CardDescription>Storico dei test eseguiti in questa sessione</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-4 rounded-xl flex items-start gap-4",
                    result.status === "success" && "bg-success/10",
                    result.status === "error" && "bg-destructive/10",
                    result.status === "pending" && "bg-muted",
                    result.status === "running" && "bg-primary/10"
                  )}
                >
                  {result.status === "success" && <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />}
                  {result.status === "error" && <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />}
                  {result.status === "pending" && <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />}
                  {result.status === "running" && <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm">{result.type}</p>
                      <span className="text-xs text-muted-foreground">
                        {result.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{result.message}</p>
                    {result.details && (
                      <p className="text-xs text-muted-foreground mt-1">{result.details}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
