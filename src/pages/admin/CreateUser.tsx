import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Mail, Building, CreditCard, Key, Copy, Check, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { defaultPlanCode, plans, type PlanCode } from "@/config/plans";

export default function CreateUser() {
  const [email, setEmail] = useState("");
  const [studioName, setStudioName] = useState("");
  const [plan, setPlan] = useState<PlanCode>(defaultPlanCode);
  const [stripeCustomerId, setStripeCustomerId] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let password = "";
    for (let i = 0; i < 16; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
    setGeneratedPassword(password);
  };

  const copyPassword = async () => {
    await navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !studioName || !generatedPassword) {
      toast({ title: "Errore", description: "Compila tutti i campi obbligatori", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email,
          studio_name: studioName,
          plan_code: plan,
          stripe_customer_id: stripeCustomerId || null,
          password: generatedPassword,
          send_email: true,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: "Cliente creato",
        description: data.email_sent
          ? `Account creato per ${email}. È stato inviato il link personale per impostare la password.`
          : `Account creato per ${email}. Email non inviata: verifica Resend prima di consegnare l'accesso.`,
      });

      setEmail("");
      setStudioName("");
      setPlan(defaultPlanCode);
      setStripeCustomerId("");
      setGeneratedPassword("");
    } catch (error) {
      console.error("Error creating user:", error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Errore durante la creazione dell'utente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Crea nuovo cliente</h1>
        <p className="text-muted-foreground">Crea tenant e accesso solo dopo verifica commerciale e del pagamento.</p>
      </div>

      {!import.meta.env.VITE_STRIPE_LIVE_VERIFIED && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Stripe live non è verificato. Controlla manualmente contratto e pagamento prima di creare un abbonamento attivo.
            </p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Informazioni cliente</CardTitle>
            <CardDescription>Email, organizzazione e piano devono coincidere con il riepilogo approvato.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email cliente</Label>
              <Input id="email" type="email" placeholder="cliente@azienda.it" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="studioName" className="flex items-center gap-2"><Building className="w-4 h-4" /> Nome azienda</Label>
              <Input id="studioName" placeholder="Azienda o studio" value={studioName} onChange={(event) => setStudioName(event.target.value)} required disabled={loading} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Piano</Label>
              <Select value={plan} onValueChange={(value) => setPlan(value as PlanCode)} disabled={loading}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {plans.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.name} · {item.pricePrefix ? `${item.pricePrefix} ` : ""}{item.priceMonth}€/mese
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stripeId">Stripe Customer ID</Label>
              <Input id="stripeId" placeholder="cus_xxxxxxxxxx" value={stripeCustomerId} onChange={(event) => setStripeCustomerId(event.target.value)} className="font-mono" disabled={loading} />
              <p className="text-xs text-muted-foreground">Lascialo vuoto soltanto durante un pilota approvato e non fatturato.</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Key className="w-4 h-4" /> Password temporanea</Label>
              <div className="flex flex-wrap gap-2">
                <Input value={generatedPassword} readOnly placeholder="Genera una password temporanea" className="font-mono flex-1 min-w-52" />
                <Button type="button" variant="outline" onClick={generatePassword} disabled={loading}>Genera</Button>
                {generatedPassword && (
                  <Button type="button" variant="outline" size="icon" onClick={copyPassword} disabled={loading} aria-label="Copia password">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">La password non viene inviata via email: il cliente riceve un link personale per impostarla.</p>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button type="submit" className="flex-1" disabled={!generatedPassword || loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creazione in corso…</> : <><UserPlus className="w-4 h-4 mr-2" />Crea account</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader><CardTitle className="text-lg">Controlli prima della creazione</CardTitle></CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Verifica piano, importo trimestrale e attivazione nel contratto.</li>
            <li>Verifica il pagamento Stripe o l'autorizzazione esplicita al pilota.</li>
            <li>Crea il tenant con l'email definitiva del cliente.</li>
            <li>Controlla l'invio del link password tramite Resend.</li>
            <li>Completa Automation Studio e Test Center prima del go-live.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
