import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MessageCircle, Phone, Plus, Search, Server, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePhoneNumbers, type PhoneNumber } from "@/hooks/usePhoneNumbers";

const providerStatusLabel: Record<PhoneNumber["provider_status"], string> = {
  pending: "Da configurare",
  provisioning: "Provisioning",
  verified: "Verificato",
  error: "Errore",
  suspended: "Sospeso",
  released: "Rilasciato",
};

export default function Provisioning() {
  const {
    phoneNumbers,
    tenants,
    stats,
    isLoading,
    createPhoneNumber,
    deletePhoneNumber,
    isCreating,
    isDeleting,
  } = usePhoneNumbers();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneType, setPhoneType] = useState<"voice" | "whatsapp">("voice");
  const [twilioNumberSid, setTwilioNumberSid] = useState("");
  const [twilioSubaccountSid, setTwilioSubaccountSid] = useState("");
  const [monthlyCost, setMonthlyCost] = useState("0");
  const [providerStatus, setProviderStatus] = useState<PhoneNumber["provider_status"]>("pending");

  const filtered = phoneNumbers.filter((number) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = number.phone_number.toLowerCase().includes(query) || number.tenant?.name?.toLowerCase().includes(query);
    return matchesSearch && (typeFilter === "all" || number.phone_type === typeFilter);
  });

  const reset = () => {
    setTenantId("");
    setPhoneNumber("");
    setPhoneType("voice");
    setTwilioNumberSid("");
    setTwilioSubaccountSid("");
    setMonthlyCost("0");
    setProviderStatus("pending");
  };

  const submit = async () => {
    if (!tenantId || !phoneNumber.trim()) return;
    if (phoneType === "voice" && providerStatus === "verified" && (!twilioNumberSid.trim() || !twilioSubaccountSid.trim())) {
      return;
    }
    await createPhoneNumber({
      tenant_id: tenantId,
      phone_number: phoneNumber.trim(),
      phone_type: phoneType,
      twilio_sid: phoneType === "voice" ? twilioNumberSid.trim() || undefined : undefined,
      twilio_subaccount_sid: phoneType === "voice" ? twilioSubaccountSid.trim() || undefined : undefined,
      provider_account_owner: phoneType === "voice" ? "platform" : "customer",
      provider_status: providerStatus,
      country_code: "IT",
      monthly_cost_cents: Math.max(0, Number(monthlyCost || 0) * 100),
    });
    reset();
    setDialogOpen(false);
  };

  if (isLoading) {
    return <div className="h-64 flex items-center justify-center" role="status"><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="sr-only">Caricamento numeri</span></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Numeri e account provider</h1>
          <p className="text-muted-foreground mt-1">Ogni tenant ha i propri numeri. La voce usa un subaccount Twilio dedicato; WhatsApp appartiene al Meta Business del cliente.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Registra numero</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Associa un numero al tenant</DialogTitle>
              <DialogDescription>Il record resta in attesa finché il provider non è stato realmente verificato.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Field label="Cliente">
                <Select value={tenantId} onValueChange={setTenantId}><SelectTrigger><SelectValue placeholder="Seleziona tenant" /></SelectTrigger><SelectContent>{tenants.map((tenant) => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>)}</SelectContent></Select>
              </Field>
              <Field label="Tipo">
                <Select value={phoneType} onValueChange={(value) => setPhoneType(value as "voice" | "whatsapp")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="voice">Voce — subaccount Twilio Clark</SelectItem><SelectItem value="whatsapp">WhatsApp — account Meta del cliente</SelectItem></SelectContent></Select>
              </Field>
              <Field label="Numero italiano"><Input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+39..." /></Field>
              <Field label="Stato provider">
                <Select value={providerStatus} onValueChange={(value) => setProviderStatus(value as PhoneNumber["provider_status"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Da configurare</SelectItem><SelectItem value="provisioning">Provisioning in corso</SelectItem><SelectItem value="verified">Verificato</SelectItem><SelectItem value="error">Errore</SelectItem></SelectContent></Select>
              </Field>
              {phoneType === "voice" ? (
                <div className="rounded-xl border p-4 space-y-4">
                  <div className="flex gap-2 text-sm text-muted-foreground"><Server className="w-4 h-4 mt-0.5 shrink-0" /><p>Inserisci SID reali del subaccount e del numero Twilio. Non usare le credenziali master nel browser.</p></div>
                  <Field label="Twilio Subaccount SID"><Input value={twilioSubaccountSid} onChange={(event) => setTwilioSubaccountSid(event.target.value)} placeholder="AC..." className="font-mono" /></Field>
                  <Field label="Twilio Phone Number SID"><Input value={twilioNumberSid} onChange={(event) => setTwilioNumberSid(event.target.value)} placeholder="PN..." className="font-mono" /></Field>
                </div>
              ) : (
                <div className="rounded-xl border p-4 flex gap-2 text-sm text-muted-foreground"><MessageCircle className="w-4 h-4 mt-0.5 shrink-0" /><p>WABA ID, Phone Number ID e token vengono acquisiti tramite Embedded Signup e conservati lato server. Questa schermata registra solo il numero visibile.</p></div>
              )}
              <Field label="Costo mensile rilevato (€)"><Input type="number" min="0" step="0.01" value={monthlyCost} onChange={(event) => setMonthlyCost(event.target.value)} /></Field>
              {phoneType === "voice" && providerStatus === "verified" && (!twilioNumberSid || !twilioSubaccountSid) && <p className="text-sm text-destructive">Per segnare un numero voce come verificato servono entrambi i SID Twilio.</p>}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button><Button onClick={() => void submit()} disabled={!tenantId || !phoneNumber.trim() || isCreating}>Registra</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label="Totali" value={stats.total} />
        <Stat label="Verificati" value={stats.active} />
        <Stat label="In attesa" value={stats.pending} />
        <Stat label="Costo mensile" value={`${stats.monthlyTotal.toFixed(2)} €`} />
      </div>

      <Card>
        <CardHeader><CardTitle>Inventario tenant</CardTitle><CardDescription>Il numero viene considerato operativo solo con stato provider “Verificato”.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="pl-9" placeholder="Cerca numero o cliente" /></div>
            <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutti</SelectItem><SelectItem value="voice">Voce</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem></SelectContent></Select>
          </div>

          {filtered.length === 0 ? <div className="py-12 text-center text-muted-foreground"><Phone className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Nessun numero trovato.</p></div> : (
            <div className="space-y-3">{filtered.map((number) => (
              <div key={number.id} className="rounded-xl border p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">{number.phone_type === "voice" ? <Phone className="w-5 h-5 text-primary" /> : <MessageCircle className="w-5 h-5 text-primary" />}</div>
                <div className="flex-1 min-w-0"><p className="font-semibold font-mono">{number.phone_number}</p><p className="text-sm text-muted-foreground truncate">{number.tenant?.name || "Tenant non assegnato"}</p></div>
                <div className="flex flex-wrap gap-2"><Badge variant="outline">{number.phone_type === "voice" ? "Twilio subaccount" : "Meta cliente"}</Badge><Badge variant={number.provider_status === "verified" ? "default" : number.provider_status === "error" ? "destructive" : "secondary"}>{number.provider_status === "verified" && <CheckCircle2 className="w-3 h-3 mr-1" />}{number.provider_status === "error" && <AlertTriangle className="w-3 h-3 mr-1" />}{providerStatusLabel[number.provider_status]}</Badge></div>
                <div className="text-sm text-muted-foreground lg:text-right"><p>{(number.monthly_cost_cents / 100).toFixed(2)} €/mese</p>{number.twilio_subaccount_sid && <p className="font-mono text-xs truncate max-w-44">{number.twilio_subaccount_sid}</p>}</div>
                <Button variant="ghost" size="icon" onClick={() => confirm("Rimuovere il record? Il provider deve essere rilasciato separatamente.") && void deletePhoneNumber(number.id)} disabled={isDeleting} aria-label={`Rimuovi ${number.phone_number}`}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></CardContent></Card>;
}
