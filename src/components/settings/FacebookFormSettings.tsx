import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Copy,
  Facebook,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FacebookForm {
  id: string;
  tenant_id: string;
  external_form_id: string;
  form_name: string | null;
  page_id: string | null;
  page_name: string | null;
  first_seen_at: string;
  last_lead_at: string | null;
  lead_count: number;
  is_active: boolean;
  created_at: string;
}

interface Settings {
  active_facebook_form_id: string | null;
  facebook_webhook_secret: string | null;
}

export function FacebookFormSettings() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);
  const [newSecret, setNewSecret] = useState("");

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
        .select("active_facebook_form_id, facebook_webhook_secret")
        .eq("tenant_id", tenantId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data as Settings | null;
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
        .update({ active_facebook_form_id: formId })
        .eq("tenant_id", tenantId);
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
      toast({ title: "Modulo attivo aggiornato" });
    },
    onError: (error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Update webhook secret mutation
  const updateSecretMutation = useMutation({
    mutationFn: async (secret: string) => {
      if (!tenantId) throw new Error("No tenant");
      const { error } = await supabase
        .from("settings")
        .update({ facebook_webhook_secret: secret })
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facebook-settings"] });
      toast({ title: "Webhook secret aggiornato" });
      setNewSecret("");
    },
    onError: (error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Generate random secret
  const generateSecret = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let secret = "";
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewSecret(secret);
  };

  const copySecret = () => {
    if (settings?.facebook_webhook_secret) {
      navigator.clipboard.writeText(settings.facebook_webhook_secret);
      toast({ title: "Secret copiato" });
    }
  };

  const activeForm = forms.find((f) => f.id === settings?.active_facebook_form_id);
  const isLoading = formsLoading || settingsLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Facebook className="h-5 w-5 text-primary" />
          <CardTitle>Modulo Facebook Attivo</CardTitle>
        </div>
        <CardDescription>
          Seleziona quale modulo Facebook Lead Ads è attivo per questo workspace. 
          I lead da altri moduli verranno comunque salvati ma marcati come "Form non attivo".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active Form Status */}
        <div className="rounded-lg border p-4 bg-muted/30">
          <Label className="text-sm text-muted-foreground">Modulo attualmente attivo</Label>
          {activeForm ? (
            <div className="flex items-center gap-2 mt-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="font-medium">{activeForm.form_name || activeForm.external_form_id}</span>
              {activeForm.page_name && (
                <Badge variant="secondary">{activeForm.page_name}</Badge>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-2 text-muted-foreground">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span>Nessun modulo attivo selezionato</span>
            </div>
          )}
        </div>

        {/* Form Selector */}
        <div className="space-y-2">
          <Label>Seleziona modulo attivo</Label>
          <Select
            value={settings?.active_facebook_form_id || "none"}
            onValueChange={(value) => 
              setActiveFormMutation.mutate(value === "none" ? null : value)
            }
            disabled={setActiveFormMutation.isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona un modulo..." />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="none">Nessun modulo attivo</SelectItem>
              {forms.map((form) => (
                <SelectItem key={form.id} value={form.id}>
                  {form.form_name || form.external_form_id}
                  {form.page_name && ` (${form.page_name})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Discovered Forms Table */}
        <div className="space-y-2">
          <Label>Moduli trovati</Label>
          <p className="text-sm text-muted-foreground">
            Questa lista si popola automaticamente quando arrivano lead dai tuoi moduli Facebook.
          </p>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : forms.length === 0 ? (
            <div className="text-center py-8 border rounded-lg bg-muted/20">
              <Facebook className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Nessun modulo trovato. I moduli appariranno qui quando arriveranno i primi lead.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modulo</TableHead>
                    <TableHead>Pagina</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Ultimo lead</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forms.map((form) => (
                    <TableRow key={form.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{form.form_name || "—"}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {form.external_form_id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{form.page_name || "—"}</p>
                          {form.page_id && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {form.page_id}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{form.lead_count}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {form.last_lead_at
                          ? format(new Date(form.last_lead_at), "d MMM yyyy HH:mm", { locale: it })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {form.is_active ? (
                          <Badge className="bg-primary/10 text-primary border-primary/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Attivo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <XCircle className="h-3 w-3 mr-1" />
                            Non attivo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Webhook Secret */}
        <div className="space-y-3 pt-4 border-t">
          <Label>Webhook Secret</Label>
          <p className="text-sm text-muted-foreground">
            Secret per validare le richieste webhook da Facebook. Usalo nella configurazione del webhook.
          </p>
          
          {settings?.facebook_webhook_secret ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-sm bg-muted px-3 py-2 rounded-md">
                {showSecret 
                  ? settings.facebook_webhook_secret 
                  : "••••••••••••••••••••••••••••••••"}
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={copySecret}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-amber-600">Nessun secret configurato</p>
          )}

          <div className="flex items-center gap-2">
            <Input
              placeholder="Nuovo secret..."
              value={newSecret}
              onChange={(e) => setNewSecret(e.target.value)}
              className="font-mono"
            />
            <Button variant="outline" onClick={generateSecret}>
              Genera
            </Button>
            <Button 
              onClick={() => updateSecretMutation.mutate(newSecret)}
              disabled={!newSecret || updateSecretMutation.isPending}
            >
              Salva
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
