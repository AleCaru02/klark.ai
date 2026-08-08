import { useEffect, useMemo, useState } from "react";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  Check,
  Clock,
  Link2,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  ShieldAlert,
  Unlink,
  XCircle,
} from "lucide-react";
import { useWhatsAppIntegration } from "@/hooks/useWhatsAppIntegration";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_TEMPLATES = {
  confirmation: "Gentile {{1}}, il Suo appuntamento è confermato per {{2}} alle ore {{3}}.",
  reminder: "Gentile {{1}}, Le ricordiamo l'appuntamento del {{2}} alle ore {{3}}.",
  canceled: "Gentile {{1}}, l'appuntamento previsto per {{2}} è stato cancellato.",
  rescheduled: "Gentile {{1}}, il nuovo appuntamento è fissato per {{2}} alle ore {{3}}.",
  missed_call: "Gentile {{1}}, abbiamo provato a contattarLa telefonicamente. Può richiamarci o rispondere a questo messaggio.",
} as const;

type TemplateType = keyof typeof DEFAULT_TEMPLATES;

const TEMPLATE_LABELS: Record<TemplateType, string> = {
  confirmation: "Conferma appuntamento",
  reminder: "Promemoria",
  canceled: "Cancellazione",
  rescheduled: "Spostamento",
  missed_call: "Chiamata senza risposta",
};

const STATUS_CONFIG = {
  pending: { icon: Clock, label: "In attesa", className: "bg-amber-500/10 text-amber-700" },
  approved: { icon: Check, label: "Approvato", className: "bg-green-500/10 text-green-700" },
  rejected: { icon: XCircle, label: "Rifiutato", className: "bg-destructive/10 text-destructive" },
};

function validateTemplateVariables(body: string): string | null {
  const indexes = Array.from(body.matchAll(/\{\{(\d+)\}\}/g)).map((match) => Number(match[1]));
  const unique = [...new Set(indexes)].sort((a, b) => a - b);
  if (unique.some((index, position) => index !== position + 1)) {
    return "Le variabili devono essere consecutive: {{1}}, {{2}}, {{3}}.";
  }
  if (/\{\{[^\d}]/.test(body) || /\{(?!\{)|(?<!\})\}/.test(body)) {
    return "La sintassi delle variabili non è valida.";
  }
  return null;
}

export default function WhatsApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    integration,
    templates,
    loading,
    connecting,
    disconnecting,
    connectionState,
    isConnected,
    error,
    connect,
    disconnect,
    createTemplate,
    refetch,
  } = useWhatsAppIntegration();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedType, setSelectedType] = useState<TemplateType | "">("");
  const [templateBody, setTemplateBody] = useState("");
  const [creating, setCreating] = useState(false);
  const e2eVerified = import.meta.env.VITE_E2E_VERIFIED === "true";

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const success = params.get("success");
    const callbackError = params.get("error");
    if (!success && !callbackError) return;

    const knownErrors: Record<string, string> = {
      missing_params: "La risposta di Meta è incompleta.",
      invalid_state: "La richiesta di collegamento è scaduta o è già stata usata.",
      no_business_found: "Nessun Business Manager idoneo è stato trovato.",
      no_waba_found: "Nessun account WhatsApp Business idoneo è stato trovato.",
      no_phone_number: "Nessun numero WhatsApp Business è disponibile.",
      token_exchange_failed: "Meta non ha completato l'autorizzazione.",
      save_failed: "La connessione non è stata salvata.",
      facebook_not_configured: "L'app Meta non è configurata sul server.",
      internal_error: "Il collegamento non è stato completato.",
    };

    if (success === "true") {
      toast.success("Autorizzazione ricevuta. Verifica lo stato della connessione.");
      void refetch();
    } else if (callbackError) {
      toast.error(knownErrors[callbackError] ?? "Il collegamento WhatsApp non è stato completato.");
    }

    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate, refetch]);

  const templateByType = useMemo(
    () => new Map(templates.map((template) => [template.template_type, template])),
    [templates],
  );
  const missingTemplates = (Object.keys(DEFAULT_TEMPLATES) as TemplateType[]).filter(
    (type) => !templateByType.has(type),
  );

  const openCreateDialog = (type?: TemplateType) => {
    const nextType = type ?? missingTemplates[0] ?? "";
    setSelectedType(nextType);
    setTemplateBody(nextType ? DEFAULT_TEMPLATES[nextType] : "");
    setShowCreateDialog(true);
  };

  const handleCreateTemplate = async () => {
    if (!selectedType) {
      toast.error("Seleziona il tipo di template.");
      return;
    }
    const body = templateBody.trim();
    if (body.length < 10 || body.length > 1024) {
      toast.error("Il testo deve contenere tra 10 e 1024 caratteri.");
      return;
    }
    const variableError = validateTemplateVariables(body);
    if (variableError) {
      toast.error(variableError);
      return;
    }

    setCreating(true);
    const created = await createTemplate(selectedType, body);
    setCreating(false);
    if (created) {
      setShowCreateDialog(false);
      setSelectedType("");
      setTemplateBody("");
    }
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm(
      "Disconnettere WhatsApp? I messaggi automatici verranno bloccati. Potrebbe essere necessario revocare anche l'app nel Business Manager Meta.",
    );
    if (confirmed) await disconnect();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Caricamento integrazione WhatsApp</span>
      </div>
    );
  }

  const connectionLabels = {
    connected: "Credenziali valide",
    expired: "Autorizzazione scaduta",
    disconnected: "Non collegato",
    error: "Configurazione incompleta",
  } as const;

  return (
    <FeatureGate
      feature="whatsapp_enabled"
      title="WhatsApp Business"
      description="Configura WhatsApp Business, template approvati e stato delle autorizzazioni."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold mb-1">WhatsApp Business</h1>
            <p className="text-muted-foreground">
              La presenza delle credenziali non equivale a un collaudo end-to-end.
            </p>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"}>
            {connectionLabels[connectionState]}
          </Badge>
        </div>

        {!e2eVerified && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="pt-6 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-medium">Canale non approvato per la produzione</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Prima del live devono essere verificati webhook, template, opt-out, consegna, errori e isolamento tra tenant.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/30">
            <CardContent className="pt-6 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm">{error}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                Riprova
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
              Connessione Meta
            </CardTitle>
            <CardDescription>
              OAuth, account WhatsApp Business e numero associato al tenant corrente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {integration ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 rounded-xl bg-muted p-4">
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" aria-hidden="true" />
                      Numero visualizzato
                    </div>
                    <p className="mt-1 text-xl font-bold font-mono">
                      {integration.display_phone_number || "Non restituito da Meta"}
                    </p>
                    {integration.verified_name && (
                      <p className="mt-1 text-sm text-muted-foreground">{integration.verified_name}</p>
                    )}
                    {integration.token_expires_at && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Scadenza autorizzazione: {new Date(integration.token_expires_at).toLocaleString("it-IT")}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" onClick={() => void handleDisconnect()} disabled={disconnecting}>
                    {disconnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlink className="w-4 h-4 mr-2" />}
                    Disconnetti
                  </Button>
                </div>
                {connectionState !== "connected" && (
                  <Button onClick={() => void connect()} disabled={connecting}>
                    {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                    Ricollega con Meta
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
                </div>
                <h2 className="font-medium mb-2">Nessun account collegato</h2>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  Servono un Business Manager Meta, un account WhatsApp Business Platform e un numero idoneo.
                </p>
                <Button onClick={() => void connect()} disabled={connecting}>
                  {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                  Collega con Meta
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {isConnected && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Template messaggi</CardTitle>
                  <CardDescription>
                    Solo i template con stato approvato possono essere considerati utilizzabili.
                  </CardDescription>
                </div>
                {missingTemplates.length > 0 && (
                  <Button onClick={() => openCreateDialog()}>
                    <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                    Crea template
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {(Object.keys(DEFAULT_TEMPLATES) as TemplateType[]).map((type) => {
                const template = templateByType.get(type);
                const config = template
                  ? STATUS_CONFIG[template.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
                  : null;
                const StatusIcon = config?.icon ?? Clock;

                return (
                  <section key={type} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{TEMPLATE_LABELS[type]}</h3>
                        {template && config ? (
                          <Badge className={config.className}>
                            <StatusIcon className="w-3 h-3 mr-1" aria-hidden="true" />
                            {config.label}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Non creato</Badge>
                        )}
                      </div>
                      {!template && (
                        <Button variant="outline" size="sm" onClick={() => openCreateDialog(type)}>
                          <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                          Crea
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg whitespace-pre-wrap">
                      {template?.body_text || DEFAULT_TEMPLATES[type]}
                    </p>
                    {template?.status === "rejected" && template.rejection_reason && (
                      <p className="mt-2 flex items-start gap-2 text-sm text-destructive">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                        {template.rejection_reason}
                      </p>
                    )}
                  </section>
                );
              })}
            </CardContent>
          </Card>
        )}

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crea template WhatsApp</DialogTitle>
              <DialogDescription>
                Il template verrà inviato a Meta. Il tempo e l'esito dell'approvazione dipendono da Meta e non sono garantiti.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="template-type">Tipo</Label>
                <Select
                  value={selectedType}
                  onValueChange={(value: TemplateType) => {
                    setSelectedType(value);
                    setTemplateBody(DEFAULT_TEMPLATES[value]);
                  }}
                >
                  <SelectTrigger id="template-type"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    {missingTemplates.map((type) => (
                      <SelectItem key={type} value={type}>{TEMPLATE_LABELS[type]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-body">Testo</Label>
                <Textarea
                  id="template-body"
                  value={templateBody}
                  onChange={(event) => setTemplateBody(event.target.value)}
                  rows={5}
                  maxLength={1024}
                  aria-describedby="template-help"
                />
                <p id="template-help" className="text-xs text-muted-foreground">
                  {templateBody.length}/1024 caratteri. Le variabili devono iniziare da {"{{1}}"} e proseguire senza salti.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Annulla</Button>
              <Button
                onClick={() => void handleCreateTemplate()}
                disabled={creating || !selectedType || templateBody.trim().length < 10}
              >
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Invia a Meta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FeatureGate>
  );
}
