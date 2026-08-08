import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2, Save, Check, User } from "lucide-react";
import { toast } from "sonner";
import { FacebookFormSettings } from "@/components/settings/FacebookFormSettings";

export default function Settings() {
  const { membership, user } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const tenantId = membership?.tenant_id;

  useEffect(() => {
    if (tenantId) {
      fetchTenantData();
    }
  }, [tenantId]);

  const fetchTenantData = async () => {
    if (!tenantId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantId)
        .single();

      if (error) throw error;

      if (data) {
        setBusinessName(data.name);
        setOriginalName(data.name);
      }
    } catch (error) {
      console.error("Error fetching tenant:", error);
      toast.error("Errore nel caricamento dei dati");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId || !businessName.trim()) {
      toast.error("Inserisci un nome valido");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ name: businessName.trim() })
        .eq("id", tenantId);

      if (error) throw error;

      setOriginalName(businessName.trim());
      toast.success("Nome attività aggiornato");
    } catch (error) {
      console.error("Error updating tenant:", error);
      toast.error("Errore nel salvataggio");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = businessName.trim() !== originalName;

  if (isLoading) {
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
        <h1 className="text-2xl font-bold mb-1">Impostazioni</h1>
        <p className="text-muted-foreground">
          Gestisci le impostazioni del tuo account e della tua attività
        </p>
      </div>

      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Account</CardTitle>
              <CardDescription>
                Informazioni del tuo account
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Email</Label>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Nome</Label>
            <p className="font-medium">{user?.user_metadata?.full_name || "Non impostato"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Business Name Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Attività</CardTitle>
              <CardDescription>
                Modifica il nome della tua attività
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="businessName">Nome Attività</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Es. Rossi Consulenze"
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              Questo nome verrà utilizzato nelle comunicazioni con i tuoi clienti
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="mt-4"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvataggio...
              </>
            ) : hasChanges ? (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salva Modifiche
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Salvato
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Facebook Form Settings */}
      <FacebookFormSettings />
    </div>
  );
}
