import { useState, useEffect } from "react";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFacebookLeadAds } from "@/hooks/useFacebookLeadAds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Facebook,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Users,
  Calendar,
  XCircle,
  Link2,
  Unlink,
  Phone,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface FacebookForm {
  id: string;
  external_form_id: string;
  form_name: string | null;
  page_id: string | null;
  page_name: string | null;
  last_lead_at: string | null;
  lead_count: number | null;
  is_active: boolean | null;
}

interface FacebookPage {
  id: string;
  name: string;
  category: string;
}

interface FacebookLeadForm {
  id: string;
  name: string;
  status: string;
  leads_count: number;
  created_time: string;
}

export default function MetaLeadAds() {
  const [searchParams] = useSearchParams();
  const { session, membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const queryClient = useQueryClient();
  const {
    isLoading,
    envConfigured,
    connected,
    integration,
    recentImports,
    totalImports,
    syncNow,
    connect,
    disconnect,
    connecting,
    refetch,
  } = useFacebookLeadAds();

  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const [optimisticActiveForms, setOptimisticActiveForms] = useState<Record<string, boolean>>({});

  const needsPageSelection = connected && integration?.page_id === "__pending__";
  const hasPageSelected = connected && integration?.page_id && integration.page_id !== "__pending__";

  // Handle OAuth callback
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "true") {
      toast.success("Facebook collegato! Ora seleziona una pagina.");
      refetch();
    } else if (error) {
      const errorMessages: Record<string, string> = {
        missing_params: "Parametri mancanti nella risposta",
        invalid_state: "Stato di autenticazione non valido",
        no_pages_found: "Nessuna pagina Facebook trovata",
        token_exchange_failed: "Errore nello scambio del token",
        save_failed: "Errore nel salvataggio",
        facebook_not_configured: "Facebook App non configurata",
        internal_error: "Errore interno del server",
      };
      toast.error(errorMessages[error] || `Errore: ${error}`);
    }
  }, [searchParams, refetch]);

  // Fetch Facebook pages (when connected but page not yet selected, or for changing page)
  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ["facebook-pages", tenantId],
    queryFn: async (): Promise<FacebookPage[]> => {
      if (!tenantId || !session?.access_token) return [];
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-leadads-pages?tenant_id=${tenantId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch pages");
      const data = await response.json();
      return data.pages || [];
    },
    enabled: !!tenantId && connected && !!session?.access_token,
  });

  // Fetch forms for selected page
  const pageIdForForms = selectedPageId || (hasPageSelected ? integration?.page_id : null);
  const { data: leadForms = [], isLoading: formsLoading } = useQuery({
    queryKey: ["facebook-lead-forms", tenantId, pageIdForForms],
    queryFn: async (): Promise<FacebookLeadForm[]> => {
      if (!tenantId || !pageIdForForms || !session?.access_token) return [];
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-leadads-pages?tenant_id=${tenantId}&page_id=${pageIdForForms}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch forms");
      const data = await response.json();
      return data.forms || [];
    },
    enabled: !!tenantId && !!pageIdForForms && !!session?.access_token,
  });

  // Fetch local forms for this tenant (from DB)
  const { data: localForms = [] } = useQuery({
    queryKey: ["facebook-forms", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("facebook_forms")
        .select("id, external_form_id, form_name, page_id, page_name, last_lead_at, lead_count, is_active")
        .eq("tenant_id", tenantId)
        .order("last_lead_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as FacebookForm[];
    },
    enabled: !!tenantId && !!hasPageSelected,
  });

  useEffect(() => {
    const nextState: Record<string, boolean> = {};
    localForms.forEach((form) => {
      nextState[form.external_form_id] = form.is_active === true;
    });
    setOptimisticActiveForms(nextState);
  }, [localForms]);

  useEffect(() => {
    setShowAllCampaigns(false);
  }, [pageIdForForms]);

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ["facebook-settings", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("settings")
        .select("active_facebook_form_id, auto_call_on_lead")
        .eq("tenant_id", tenantId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Select page mutation
  const selectPageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      if (!tenantId || !session?.access_token) throw new Error("No session");
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-leadads-select-page`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tenant_id: tenantId, page_id: pageId }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to select page");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Pagina "${data.page_name}" selezionata!`);
      queryClient.invalidateQueries({ queryKey: ["facebook-leadads-status"] });
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Toggle form active/inactive (multi-select)
  const toggleFormActiveMutation = useMutation({
    mutationFn: async ({ externalFormId, formName, active }: { externalFormId: string; formName: string; active: boolean }) => {
      if (!tenantId) throw new Error("No tenant");
      if (!session?.user) throw new Error("Sessione non valida: effettua di nuovo il login");

      const { data: existing, error: findError } = await supabase
        .from("facebook_forms")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("external_form_id", externalFormId)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        const { error: updateError } = await supabase
          .from("facebook_forms")
          .update({ is_active: active })
          .eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("facebook_forms")
          .insert({
            tenant_id: tenantId,
            external_form_id: externalFormId,
            form_name: formName,
            page_id: integration?.page_id || null,
            page_name: currentPage?.name || null,
            is_active: active,
          } as any);
        if (insertError) throw insertError;
      }
    },
    onMutate: ({ externalFormId, active }) => {
      const previous = optimisticActiveForms[externalFormId] ?? false;
      setOptimisticActiveForms((prev) => ({ ...prev, [externalFormId]: active }));
      return { previous, externalFormId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facebook-forms", tenantId] });
      toast.success("Modulo aggiornato");
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.externalFormId) {
        setOptimisticActiveForms((prev) => ({ ...prev, [ctx.externalFormId]: ctx.previous ?? false }));
      }
      toast.error(err.message || "Errore nell'aggiornamento del modulo");
    },
  });

  // Toggle auto-call
  const toggleAutoCallMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!tenantId) throw new Error("No tenant");
      const { error } = await supabase
        .from("settings")
        .update({ auto_call_on_lead: enabled } as any)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facebook-settings"] });
      toast.success("Impostazione aggiornata");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncNow.mutateAsync();
    } finally {
      setIsSyncing(false);
    }
  };

  const currentPage = pages.find((p) => p.id === integration?.page_id);
  const sortedLeadForms = [...leadForms].sort((a, b) => {
    const aTs = a.created_time ? new Date(a.created_time).getTime() : 0;
    const bTs = b.created_time ? new Date(b.created_time).getTime() : 0;
    return bTs - aTs;
  });
  const visibleLeadForms = showAllCampaigns ? sortedLeadForms : sortedLeadForms.slice(0, 3);
  const hiddenLeadFormsCount = Math.max(sortedLeadForms.length - 3, 0);
  const activeFormsCount = Object.values(optimisticActiveForms).filter(Boolean).length;

  return (
    <FeatureGate
      feature="ads_enabled"
      title="Meta Lead Ads"
      description="Importa automaticamente i lead dalle tue campagne Facebook e Instagram. I contatti vengono inseriti nel CRM e contattati dalla segretaria AI."
    >
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link to="/app/integrations" className="text-muted-foreground hover:text-foreground">
            Integrazioni
          </Link>
          <span className="text-muted-foreground">/</span>
          <span>Facebook Lead Ads</span>
        </div>
        <h1 className="text-2xl font-bold mb-1">Facebook Lead Ads</h1>
        <p className="text-muted-foreground">
          Importa automaticamente i lead dalle tue campagne Facebook e avvia le chiamate AI
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
                <Facebook className="w-6 h-6 text-[#1877F2]" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Stato Integrazione
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : !envConfigured ? (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      <XCircle className="w-3 h-3 mr-1" />
                      Disattivo
                    </Badge>
                  ) : hasPageSelected ? (
                    <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                      <Check className="w-3 h-3 mr-1" />
                      Connesso
                    </Badge>
                  ) : needsPageSelection ? (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Seleziona pagina
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Non connesso
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {!envConfigured
                    ? "L'admin deve configurare le credenziali Meta"
                    : hasPageSelected
                    ? `Pagina: ${currentPage?.name || integration?.page_id}`
                    : needsPageSelection
                    ? "Account collegato — seleziona una pagina Facebook"
                    : "Collega la tua pagina Facebook per importare i lead"}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!envConfigured ? (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Integrazione non disponibile</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Le credenziali Meta (App ID, App Secret) non sono state configurate.
                Contatta l'amministratore per attivare questa integrazione.
              </p>
            </div>
          ) : !connected ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-[#1877F2]/10 flex items-center justify-center mb-4">
                <Facebook className="w-8 h-8 text-[#1877F2]" />
              </div>
              <h3 className="font-medium mb-2">Nessuna pagina collegata</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Collega il tuo account Facebook per iniziare a ricevere automaticamente i lead
                dalle tue campagne Lead Ads.
              </p>
              <Button onClick={connect} disabled={connecting}>
                {connecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4 mr-2" />
                )}
                Collega con Facebook
              </Button>
            </div>
          ) : (
            <>
              {/* Stats (only when page selected) */}
              {hasPageSelected && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">Lead importati</span>
                    </div>
                    <p className="text-2xl font-bold">{totalImports}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Ultima sincronizzazione</span>
                    </div>
                    <p className="text-sm font-medium">
                      {integration?.updated_at
                        ? format(new Date(integration.updated_at), "dd MMM yyyy HH:mm", { locale: it })
                        : "Mai"}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {hasPageSelected && (
                  <Button onClick={handleSync} disabled={isSyncing}>
                    {isSyncing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sincronizzazione...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sincronizza ora
                      </>
                    )}
                  </Button>
                )}
                <Button variant="outline" onClick={disconnect}>
                  <Unlink className="w-4 h-4 mr-2" />
                  Disconnetti
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Page Selection Card */}
      {connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#1877F2]" />
              Pagina Facebook
            </CardTitle>
            <CardDescription>
              Seleziona la pagina Facebook da cui vuoi ricevere i lead
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pagesLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Caricamento pagine...</span>
              </div>
            ) : pages.length === 0 ? (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  Nessuna pagina trovata. Assicurati di aver dato i permessi per le pagine durante il login Facebook.
                </p>
              </div>
            ) : (
              <>
                {hasPageSelected && currentPage && (
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-sm">{currentPage.name}</span>
                    <Badge variant="secondary" className="text-xs">{currentPage.category}</Badge>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{hasPageSelected ? "Cambia pagina" : "Seleziona pagina"}</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedPageId || ""}
                      onValueChange={(v) => setSelectedPageId(v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Scegli una pagina..." />
                      </SelectTrigger>
                      <SelectContent>
                        {pages.map((page) => (
                          <SelectItem key={page.id} value={page.id}>
                            {page.name} ({page.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      disabled={!selectedPageId || selectPageMutation.isPending}
                      onClick={() => selectedPageId && selectPageMutation.mutate(selectedPageId)}
                    >
                      {selectPageMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Conferma"
                      )}
                    </Button>
                  </div>
                </div>

                {/* Show all pages */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pagina</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Stato</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pages.map((page) => (
                        <TableRow
                          key={page.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedPageId(page.id)}
                        >
                          <TableCell className="font-medium">{page.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{page.category}</TableCell>
                          <TableCell>
                            {page.id === integration?.page_id ? (
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Attiva
                              </Badge>
                            ) : page.id === selectedPageId ? (
                              <Badge variant="outline" className="text-primary border-primary/30">
                                Selezionata
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                —
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lead Forms from Facebook (live from API) — multi-select */}
      {hasPageSelected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#1877F2]" />
              Campagne Lead Ads
            </CardTitle>
            <CardDescription>
              Seleziona le campagne/moduli da cui vuoi ricevere lead e attivare le chiamate AI
            </CardDescription>
          </CardHeader>
          <CardContent>
            {formsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Caricamento moduli dalla pagina...</span>
              </div>
            ) : leadForms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nessun modulo Lead Ads trovato su questa pagina</p>
                <p className="text-sm">Crea una campagna Lead Ads su Facebook per vedere i moduli qui.</p>
              </div>
            ) : (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Attivo</TableHead>
                        <TableHead>Nome Modulo</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead>Creato</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleLeadForms.map((form) => {
                        const localForm = localForms.find((lf) => lf.external_form_id === form.id);
                        const isActive = optimisticActiveForms[form.id] ?? (localForm?.is_active === true);
                        return (
                          <TableRow key={form.id}>
                            <TableCell>
                              <Switch
                                checked={isActive}
                                onCheckedChange={(checked) => {
                                  toggleFormActiveMutation.mutate({ externalFormId: form.id, formName: form.name, active: checked });
                                }}
                                disabled={toggleFormActiveMutation.isPending}
                              />
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">{form.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{form.id}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant={form.status === "ACTIVE" ? "default" : "secondary"}>
                                {form.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{form.leads_count}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {form.created_time
                                ? format(new Date(form.created_time), "d MMM yyyy", { locale: it })
                                : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {hiddenLeadFormsCount > 0 && !showAllCampaigns && (
                  <div className="flex justify-end mt-3">
                    <Button variant="outline" size="sm" onClick={() => setShowAllCampaigns(true)}>
                      Scopri di più ({hiddenLeadFormsCount})
                    </Button>
                  </div>
                )}

                {showAllCampaigns && hiddenLeadFormsCount > 0 && (
                  <div className="flex justify-end mt-3">
                    <Button variant="ghost" size="sm" onClick={() => setShowAllCampaigns(false)}>
                      Mostra solo le ultime 3
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Auto-call toggle (only when page selected) */}
      {hasPageSelected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              Automazione Chiamate
            </CardTitle>
            <CardDescription>
              Attiva la chiamata automatica AI sui nuovi lead dalle campagne selezionate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Chiamata automatica</Label>
                    <p className="text-xs text-muted-foreground">
                      Quando arriva un nuovo lead da un modulo attivo, avvia automaticamente una chiamata AI
                    </p>
                  </div>
                </div>
                <Switch
                  checked={(settings as any)?.auto_call_on_lead ?? false}
                  onCheckedChange={(checked) => toggleAutoCallMutation.mutate(checked)}
                  disabled={toggleAutoCallMutation.isPending}
                />
              </div>
              {(settings as any)?.auto_call_on_lead && (
                <div className="text-xs text-muted-foreground bg-background/50 rounded p-2">
                  ✅ I nuovi lead dai moduli attivi verranno inseriti nella coda chiamate e contattati automaticamente dalla segretaria AI.
                </div>
              )}
              {activeFormsCount === 0 && (
                <div className="text-xs text-amber-600 bg-amber-500/10 rounded p-2">
                  ⚠️ Nessun modulo attivo selezionato. Attiva almeno un modulo dalla sezione "Campagne Lead Ads" sopra.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Imports Table */}
      {hasPageSelected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ultimi lead importati</CardTitle>
            <CardDescription>
              Gli ultimi 20 lead importati da Facebook Lead Ads
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentImports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nessun lead importato ancora</p>
                <p className="text-sm">I lead appariranno qui dopo la prima sincronizzazione</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead>Importato il</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentImports.map((importItem) => (
                    <TableRow key={importItem.id}>
                      <TableCell className="font-medium">
                        {importItem.contacts?.name || "—"}
                      </TableCell>
                      <TableCell>{importItem.contacts?.email || "—"}</TableCell>
                      <TableCell>{importItem.contacts?.phone_e164 || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(importItem.imported_at), "dd MMM yyyy HH:mm", {
                          locale: it,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Come funziona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">1</span>
            </div>
            <p>Clicca "Collega con Facebook" e autorizza l'accesso alle tue pagine.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">2</span>
            </div>
            <p>Seleziona la <strong>pagina Facebook</strong> dalla quale vuoi ricevere i lead.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">3</span>
            </div>
            <p>Verifica le <strong>campagne/moduli Lead Ads</strong> attivi sulla pagina.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">4</span>
            </div>
            <p>Attiva la "Chiamata automatica" per far partire la segretaria AI su ogni nuovo lead.</p>
          </div>
        </CardContent>
      </Card>
    </div>
    </FeatureGate>
  );
}
