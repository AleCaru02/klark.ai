import { useState } from "react";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { useLeads, Lead, LeadStatus } from "@/hooks/useLeads";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  MessageSquare,
  Clock,
  XCircle,
  CheckCircle,
  CalendarCheck,
  UserX,
  Ban,
  Loader2,
  Zap,
  AlertTriangle,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface NextBestActionResult {
  next_action: "CALL" | "WHATSAPP" | "WAIT" | "CLOSE";
  planned_delay_minutes: number;
  call_script: {
    opening: string;
    questions: string[];
    objection_handlers: string[];
    closing: string;
  };
  whatsapp_message: string;
  crm_updates: {
    status: string;
    priority_score_delta: number;
    tags_add: string[];
    tags_remove: string[];
  };
  reminders: {
    send_confirm_now: boolean;
    send_24h_before: boolean;
    send_2h_before: boolean;
  };
  safety: {
    opt_out_detected: boolean;
    compliance_notes: string;
  };
}

interface FollowupRunResult {
  processed: number;
  results: Array<{
    lead_id: string;
    lead_name: string;
    success: boolean;
    next_action?: string;
    planned_at?: string;
    call_script?: NextBestActionResult["call_script"];
    whatsapp_message?: string;
    safety?: NextBestActionResult["safety"];
    error?: string;
  }>;
}

const actionIcons: Record<string, React.ReactNode> = {
  CALL: <Phone className="h-5 w-5" />,
  WHATSAPP: <MessageSquare className="h-5 w-5" />,
  WAIT: <Clock className="h-5 w-5" />,
  CLOSE: <XCircle className="h-5 w-5" />,
};

const actionColors: Record<string, string> = {
  CALL: "bg-blue-500",
  WHATSAPP: "bg-green-500",
  WAIT: "bg-yellow-500",
  CLOSE: "bg-red-500",
};

export default function FollowupEngine() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const { leads, isLoading: leadsLoading } = useLeads({});

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionResult, setActionResult] = useState<FollowupRunResult["results"][0] | null>(null);
  const [isMarkingOutcome, setIsMarkingOutcome] = useState(false);

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  const handleRunNextBestAction = async () => {
    if (!tenantId || !selectedLeadId) {
      toast.error("Seleziona un lead");
      return;
    }

    setIsProcessing(true);
    setActionResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("followup-run", {
        body: { tenant_id: tenantId, mode: "single", lead_id: selectedLeadId },
      });

      if (error) {
        throw error;
      }

      const result = data as FollowupRunResult;
      if (result.results && result.results.length > 0) {
        setActionResult(result.results[0]);
        if (result.results[0].success) {
          toast.success(`Azione: ${result.results[0].next_action}`);
        } else {
          toast.error(`Errore: ${result.results[0].error}`);
        }
      }
    } catch (error) {
      console.error("Error running followup:", error);
      toast.error("Errore nell'esecuzione del follow-up");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkOutcome = async (
    outcome: string,
    channel: string = "simulated"
  ) => {
    if (!tenantId || !selectedLeadId) return;

    setIsMarkingOutcome(true);

    try {
      const { data, error } = await supabase.functions.invoke("followup-mark-outcome", {
        body: {
          tenant_id: tenantId,
          lead_id: selectedLeadId,
          channel,
          outcome,
          content: `Esito registrato: ${outcome}`,
        },
      });

      if (error) {
        throw error;
      }

      toast.success(`Esito registrato: ${outcome}`);

      // If there's a next action, show it
      if (data.next_action) {
        setActionResult({
          lead_id: selectedLeadId,
          lead_name: selectedLead?.name || "",
          success: true,
          next_action: data.next_action.next_action,
          planned_at: new Date(Date.now() + data.next_action.planned_delay_minutes * 60000).toISOString(),
          call_script: data.next_action.call_script,
          whatsapp_message: data.next_action.whatsapp_message,
          safety: data.next_action.safety,
        });
      } else {
        setActionResult(null);
      }
    } catch (error) {
      console.error("Error marking outcome:", error);
      toast.error("Errore nel registrare l'esito");
    } finally {
      setIsMarkingOutcome(false);
    }
  };

  const outcomeButtons = [
    { label: "Risposto", outcome: "answered", icon: <CheckCircle className="h-4 w-4" />, variant: "default" as const },
    { label: "Non risponde", outcome: "no_answer", icon: <Phone className="h-4 w-4" />, variant: "secondary" as const },
    { label: "STOP", outcome: "opt_out", icon: <Ban className="h-4 w-4" />, variant: "destructive" as const },
    { label: "Appuntamento", outcome: "appointment_set", icon: <CalendarCheck className="h-4 w-4" />, variant: "default" as const },
    { label: "Perso", outcome: "lost", icon: <UserX className="h-4 w-4" />, variant: "outline" as const },
  ];

  return (
    <FeatureGate
      feature="followup_basic_enabled"
      title="Follow-up Engine"
      description="Sequenze automatiche di richiamata e messaggi WhatsApp per contattare lead non raggiunti. Configura tentativi, intervalli e canali."
    >
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="h-8 w-8" />
          Follow-up Engine
        </h1>
        <p className="text-muted-foreground">
          AI-powered: decide automaticamente la prossima azione per ogni lead
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Panel: Lead Selection + Action */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seleziona Lead</CardTitle>
              <CardDescription>
                Scegli un lead per eseguire l'analisi AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={selectedLeadId || ""}
                onValueChange={(value) => {
                  setSelectedLeadId(value);
                  setActionResult(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un lead..." />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      <div className="flex items-center gap-2">
                        <span>{lead.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {lead.status}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedLead && (
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{selectedLead.name}</span>
                    <Badge>{selectedLead.status}</Badge>
                  </div>
                  {selectedLead.phone_e164 && (
                    <p className="text-sm text-muted-foreground">{selectedLead.phone_e164}</p>
                  )}
                  {selectedLead.source && (
                    <p className="text-sm text-muted-foreground">Fonte: {selectedLead.source}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Priority:</span>
                    <span className="font-medium">{selectedLead.priority_score}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleRunNextBestAction}
                disabled={!selectedLeadId || isProcessing}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisi AI in corso...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Esegui Next Best Action
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Outcome Buttons */}
          {selectedLeadId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Registra Esito</CardTitle>
                <CardDescription>
                  Registra l'esito del contatto e genera la prossima azione
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {outcomeButtons.map((btn) => (
                    <Button
                      key={btn.outcome}
                      variant={btn.variant}
                      onClick={() => handleMarkOutcome(btn.outcome)}
                      disabled={isMarkingOutcome}
                      className="gap-2"
                    >
                      {btn.icon}
                      {btn.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel: Result */}
        <div>
          {actionResult ? (
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {actionResult.next_action && actionIcons[actionResult.next_action]}
                    Risultato AI
                  </CardTitle>
                  {actionResult.next_action && (
                    <Badge className={actionColors[actionResult.next_action]}>
                      {actionResult.next_action}
                    </Badge>
                  )}
                </div>
                {actionResult.planned_at && (
                  <CardDescription>
                    Pianificato per: {format(new Date(actionResult.planned_at), "dd MMM yyyy HH:mm", { locale: it })}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {/* Safety Warning */}
                    {actionResult.safety?.opt_out_detected && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                        <div>
                          <p className="font-medium text-destructive">Opt-out rilevato</p>
                          <p className="text-sm text-muted-foreground">
                            {actionResult.safety.compliance_notes}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Call Script */}
                    {actionResult.next_action === "CALL" && actionResult.call_script && (
                      <div className="space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Script Chiamata
                        </h4>
                        
                        <div className="bg-muted rounded-lg p-3 space-y-2">
                          <div>
                            <span className="text-xs text-muted-foreground uppercase">Apertura</span>
                            <p className="text-sm">{actionResult.call_script.opening}</p>
                          </div>
                        </div>

                        {actionResult.call_script.questions?.length > 0 && (
                          <div className="bg-muted rounded-lg p-3 space-y-2">
                            <span className="text-xs text-muted-foreground uppercase">Domande</span>
                            <ul className="text-sm space-y-1">
                              {actionResult.call_script.questions.map((q, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-primary font-medium">{i + 1}.</span>
                                  {q}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {actionResult.call_script.objection_handlers?.length > 0 && (
                          <div className="bg-muted rounded-lg p-3 space-y-2">
                            <span className="text-xs text-muted-foreground uppercase">Gestione Obiezioni</span>
                            <ul className="text-sm space-y-1">
                              {actionResult.call_script.objection_handlers.map((o, i) => (
                                <li key={i}>• {o}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="bg-muted rounded-lg p-3 space-y-2">
                          <span className="text-xs text-muted-foreground uppercase">Chiusura</span>
                          <p className="text-sm">{actionResult.call_script.closing}</p>
                        </div>
                      </div>
                    )}

                    {/* WhatsApp Message */}
                    {actionResult.next_action === "WHATSAPP" && actionResult.whatsapp_message && (
                      <div className="space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Messaggio WhatsApp
                        </h4>
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                          <p className="text-sm whitespace-pre-wrap">{actionResult.whatsapp_message}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {actionResult.whatsapp_message.length}/350 caratteri
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Wait/Close Info */}
                    {actionResult.next_action === "WAIT" && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                        <p className="font-medium">In attesa</p>
                        <p className="text-sm text-muted-foreground">
                          La prossima azione verrà eseguita automaticamente.
                        </p>
                      </div>
                    )}

                    {actionResult.next_action === "CLOSE" && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                        <p className="font-medium">Lead chiuso</p>
                        <p className="text-sm text-muted-foreground">
                          Non verranno eseguite ulteriori azioni su questo lead.
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Seleziona un lead e clicca su "Esegui Next Best Action"</p>
                <p className="text-sm mt-1">per vedere il risultato dell'analisi AI</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
    </FeatureGate>
  );
}
