import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft, Phone, MessageCircle, Calendar, ClipboardList,
  Settings, Save, Trash2, AlertTriangle, Loader2, Users, Mail,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { plans, type PlanCode } from "@/config/plans";

interface TenantData {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface TenantProfile {
  id: string;
  email: string | null;
  role: string;
  created_at: string;
}

interface TenantServiceAccount {
  tenant_id: string;
  plan_code: PlanCode;
  status: "pending" | "active" | "suspended" | "cancelled";
  activated_at: string | null;
  service_end_at: string | null;
  renewal_due_at: string | null;
  next_payment_at: string | null;
  admin_notes: string | null;
  updated_at: string;
}


interface TenantPhoneNumber {
  id: string;
  phone_number: string;
  phone_type: string;
  status: string;
  country_code: string | null;
  monthly_cost_cents: number | null;
}

interface TenantSettings {
  voice_enabled: boolean | null;
  whatsapp_enabled: boolean | null;
  calendar_enabled: boolean | null;
  recording_opt_in: boolean | null;
  retention_days: number | null;
  voice_number: string | null;
  whatsapp_display_number: string | null;
}

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [profiles, setProfiles] = useState<TenantProfile[]>([]);
  const [serviceAccount, setServiceAccount] = useState<TenantServiceAccount | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<TenantPhoneNumber[]>([]);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [stats, setStats] = useState({ voiceMin: 0, waMessages: 0, appointments: 0 });

  // Editable fields
  const [editName, setEditName] = useState("");

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [tenantRes, profilesRes, serviceRes, phonesRes, settingsRes] = await Promise.all([
      supabase.from("tenants").select("*").eq("id", id).single(),
      supabase.from("profiles").select("*").eq("tenant_id", id),
      supabase.from("tenant_service_accounts").select("*").eq("tenant_id", id).maybeSingle(),
      supabase.from("tenant_phone_numbers").select("*").eq("tenant_id", id),
      supabase.from("settings").select("voice_enabled, whatsapp_enabled, calendar_enabled, recording_opt_in, retention_days, voice_number, whatsapp_display_number").eq("tenant_id", id).maybeSingle(),
    ]);

    if (tenantRes.data) {
      setTenant(tenantRes.data as TenantData);
      setEditName(tenantRes.data.name);
    }
    if (profilesRes.data) setProfiles(profilesRes.data as TenantProfile[]);
    if (serviceRes.data) setServiceAccount(serviceRes.data as TenantServiceAccount);
    if (phonesRes.data) setPhoneNumbers(phonesRes.data as TenantPhoneNumber[]);
    if (settingsRes.data) setSettings(settingsRes.data as TenantSettings);

    // Fetch usage stats for current month
    const now = new Date();
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

    const [voiceRes, waRes, apptRes] = await Promise.all([
      supabase.from("usage_voice_daily").select("connected_seconds").eq("tenant_id", id).gte("date", monthStart).lte("date", monthEnd),
      supabase.from("usage_wa_daily").select("template_counts_json").eq("tenant_id", id).gte("date", monthStart).lte("date", monthEnd),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    ]);

    const totalVoiceSec = (voiceRes.data || []).reduce((sum, r) => sum + (r.connected_seconds || 0), 0);
    const totalWa = (waRes.data || []).length; // simplified count
    setStats({
      voiceMin: Math.round(totalVoiceSec / 60),
      waMessages: totalWa,
      appointments: apptRes.count || 0,
    });

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveName = async () => {
    if (!id || !editName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("tenants").update({ name: editName.trim() }).eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Errore nel salvataggio");
    } else {
      toast.success("Nome aggiornato");
      setTenant((prev) => prev ? { ...prev, name: editName.trim() } : prev);
    }
  };

  const handleSaveSettings = async () => {
    if (!id || !settings) return;
    setSaving(true);
    const { error } = await supabase.from("settings").update({
      recording_opt_in: settings.recording_opt_in,
      retention_days: settings.retention_days,
    }).eq("tenant_id", id);
    setSaving(false);
    if (error) toast.error("Errore"); else toast.success("Impostazioni salvate");
  };

  const handleSaveServiceAccount = async () => {
    if (!id || !serviceAccount) return;
    setSaving(true);
    const { error } = await supabase
      .from("tenant_service_accounts")
      .update({
        plan_code: serviceAccount.plan_code,
        status: serviceAccount.status,
        service_end_at: serviceAccount.service_end_at || null,
        renewal_due_at: serviceAccount.renewal_due_at || null,
        next_payment_at: serviceAccount.next_payment_at || null,
        admin_notes: serviceAccount.admin_notes?.trim() || null,
      })
      .eq("tenant_id", id);
    setSaving(false);
    if (error) {
      toast.error(`Errore stato cliente: ${error.message}`);
      return;
    }
    toast.success("Stato cliente aggiornato");
    await fetchData();
  };

  const toLocalDateTimeValue = (value: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  };

  const fromLocalDateTimeValue = (value: string) => value ? new Date(value).toISOString() : null;

  const planLabels: Record<string, string> = {
    essential: "Essential",
    growth: "Growth",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  const serviceStatusLabels: Record<TenantServiceAccount["status"], string> = {
    pending: "Pending",
    active: "Attivo",
    suspended: "Sospeso",
    cancelled: "Cancellato",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Tenant non trovato</p>
        <Button asChild className="mt-4"><Link to="/admin">Torna ai clienti</Link></Button>
      </div>
    );
  }

  const primaryEmail = profiles.find((p) => p.role === "user" || p.role === "customer")?.email || profiles[0]?.email || "-";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{tenant.name}</h1>
            {serviceAccount && (
              <Badge variant={serviceAccount.status === "active" ? "default" : serviceAccount.status === "pending" ? "secondary" : "destructive"}>
                {serviceStatusLabels[serviceAccount.status]}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{primaryEmail}</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Utenti ({profiles.length})</TabsTrigger>
          <TabsTrigger value="numbers">Numeri ({phoneNumbers.length})</TabsTrigger>
          <TabsTrigger value="commercial">Commerciale</TabsTrigger>
          <TabsTrigger value="settings">Impostazioni</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.voiceMin}</p>
                    <p className="text-sm text-muted-foreground">min voice (mese)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.waMessages}</p>
                    <p className="text-sm text-muted-foreground">giorni con WA</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.appointments}</p>
                    <p className="text-sm text-muted-foreground">appuntamenti</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Informazioni Tenant</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Studio</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={tenant.slug || ""} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Piano</Label>
                  <Input value={planLabels[serviceAccount?.plan_code || ""] || serviceAccount?.plan_code || "-"} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Creato il</Label>
                  <Input value={new Date(tenant.created_at).toLocaleDateString("it-IT")} readOnly className="bg-muted" />
                </div>
              </div>
              <Button onClick={handleSaveName} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salva Modifiche
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Utenti del Tenant
              </CardTitle>
              <CardDescription>Tutti gli utenti associati a questo tenant</CardDescription>
            </CardHeader>
            <CardContent>
              {profiles.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nessun utente trovato</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Ruolo</TableHead>
                      <TableHead>Creato il</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          {p.email || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.role === "admin" ? "default" : "secondary"}>{p.role}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("it-IT")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Numbers Tab */}
        <TabsContent value="numbers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Numeri Assegnati
              </CardTitle>
            </CardHeader>
            <CardContent>
              {phoneNumbers.length === 0 ? (
                <div className="text-center py-8">
                  <Phone className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Nessun numero assegnato</p>
                  <Button asChild variant="outline" className="mt-3">
                    <Link to="/admin/provisioning">Vai al Provisioning</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {phoneNumbers.map((num) => (
                    <div key={num.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${num.phone_type === "voice" ? "bg-primary/10" : "bg-success/10"}`}>
                          {num.phone_type === "voice" ? <Phone className="w-5 h-5 text-primary" /> : <MessageCircle className="w-5 h-5 text-success" />}
                        </div>
                        <div>
                          <p className="font-mono font-semibold">{num.phone_number}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{num.phone_type}</Badge>
                            <Badge variant={num.status === "active" ? "default" : "secondary"}>{num.status}</Badge>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">€{((num.monthly_cost_cents || 0) / 100).toFixed(2)}/mese</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Integration status */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className={`border-l-4 ${settings?.voice_enabled ? "border-l-primary" : "border-l-muted"}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4" /><span className="font-medium">Voice</span></div>
                  <Badge variant={settings?.voice_enabled ? "default" : "secondary"}>{settings?.voice_enabled ? "Attivo" : "Off"}</Badge>
                </div>
                {settings?.voice_number && <p className="text-xs text-muted-foreground mt-1 font-mono">{settings.voice_number}</p>}
              </CardContent>
            </Card>
            <Card className={`border-l-4 ${settings?.whatsapp_enabled ? "border-l-success" : "border-l-muted"}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4" /><span className="font-medium">WhatsApp</span></div>
                  <Badge variant={settings?.whatsapp_enabled ? "default" : "secondary"}>{settings?.whatsapp_enabled ? "Attivo" : "Off"}</Badge>
                </div>
                {settings?.whatsapp_display_number && <p className="text-xs text-muted-foreground mt-1 font-mono">{settings.whatsapp_display_number}</p>}
              </CardContent>
            </Card>
            <Card className={`border-l-4 ${settings?.calendar_enabled ? "border-l-accent" : "border-l-muted"}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span className="font-medium">Calendario</span></div>
                  <Badge variant={settings?.calendar_enabled ? "default" : "secondary"}>{settings?.calendar_enabled ? "Attivo" : "Off"}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Commercial / service state */}
        <TabsContent value="commercial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5" />Stato cliente</CardTitle>
              <CardDescription>Gestione amministrativa manuale della Fase 1. Non rappresenta una subscription di un provider di pagamento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!serviceAccount ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  Stato cliente non configurato. Il tenant resta non operativo.
                </div>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Piano assegnato</Label>
                      <Select
                        value={serviceAccount.plan_code}
                        onValueChange={(value) => setServiceAccount((prev) => prev ? { ...prev, plan_code: value as PlanCode } : prev)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {plans.map((plan) => <SelectItem key={plan.code} value={plan.code}>{plan.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Stato cliente</Label>
                      <Select
                        value={serviceAccount.status}
                        onValueChange={(value) => setServiceAccount((prev) => prev ? { ...prev, status: value as TenantServiceAccount["status"] } : prev)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="active">Attivo</SelectItem>
                          <SelectItem value="suspended">Sospeso</SelectItem>
                          <SelectItem value="cancelled">Cancellato</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Attivato il</Label>
                      <Input value={serviceAccount.activated_at ? new Date(serviceAccount.activated_at).toLocaleString("it-IT") : "Non ancora attivo"} readOnly className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Fine servizio</Label>
                      <Input type="datetime-local" value={toLocalDateTimeValue(serviceAccount.service_end_at)} onChange={(event) => setServiceAccount((prev) => prev ? { ...prev, service_end_at: fromLocalDateTimeValue(event.target.value) } : prev)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Scadenza / rinnovo</Label>
                      <Input type="datetime-local" value={toLocalDateTimeValue(serviceAccount.renewal_due_at)} onChange={(event) => setServiceAccount((prev) => prev ? { ...prev, renewal_due_at: fromLocalDateTimeValue(event.target.value) } : prev)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Prossimo pagamento</Label>
                      <Input type="datetime-local" value={toLocalDateTimeValue(serviceAccount.next_payment_at)} onChange={(event) => setServiceAccount((prev) => prev ? { ...prev, next_payment_at: fromLocalDateTimeValue(event.target.value) } : prev)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Note amministrative</Label>
                    <Textarea rows={5} value={serviceAccount.admin_notes || ""} onChange={(event) => setServiceAccount((prev) => prev ? { ...prev, admin_notes: event.target.value } : prev)} placeholder="Contratto, pagamento manuale, scadenze, note operative…" />
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                    Gli stati pending, suspended e cancelled bloccano le operazioni runtime protette. Il passaggio ad active sarà ulteriormente vincolato alla checklist di readiness prima del go-live.
                  </div>
                  <Button onClick={handleSaveServiceAccount} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Salva stato cliente
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Impostazioni</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Recording Abilitato</p>
                  <p className="text-sm text-muted-foreground">Salva le registrazioni delle chiamate</p>
                </div>
                <Switch
                  checked={settings?.recording_opt_in || false}
                  onCheckedChange={(v) => setSettings((prev) => prev ? { ...prev, recording_opt_in: v } : prev)}
                />
              </div>
              <div className="space-y-2">
                <Label>Retention Log (giorni)</Label>
                <Input
                  type="number"
                  value={settings?.retention_days || 365}
                  onChange={(e) => setSettings((prev) => prev ? { ...prev, retention_days: parseInt(e.target.value) || 365 } : prev)}
                />
              </div>
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salva Impostazioni
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />Zona Pericolosa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Questa azione è irreversibile.</p>
              <Button variant="destructive"><Trash2 className="w-4 h-4 mr-2" />Elimina Tenant</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
