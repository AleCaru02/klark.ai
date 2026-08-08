import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft, Phone, MessageCircle, Calendar, CreditCard,
  Settings, Save, Trash2, AlertTriangle, Loader2, Users, Mail, Globe,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

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

interface TenantSubscription {
  plan_code: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  period_start: string | null;
  period_end: string | null;
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
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<TenantPhoneNumber[]>([]);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [stats, setStats] = useState({ voiceMin: 0, waMessages: 0, appointments: 0 });

  // Editable fields
  const [editName, setEditName] = useState("");

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [tenantRes, profilesRes, subsRes, phonesRes, settingsRes] = await Promise.all([
      supabase.from("tenants").select("*").eq("id", id).single(),
      supabase.from("profiles").select("*").eq("tenant_id", id),
      supabase.from("subscriptions").select("*").eq("tenant_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("tenant_phone_numbers").select("*").eq("tenant_id", id),
      supabase.from("settings").select("voice_enabled, whatsapp_enabled, calendar_enabled, recording_opt_in, retention_days, voice_number, whatsapp_display_number").eq("tenant_id", id).maybeSingle(),
    ]);

    if (tenantRes.data) {
      setTenant(tenantRes.data as TenantData);
      setEditName(tenantRes.data.name);
    }
    if (profilesRes.data) setProfiles(profilesRes.data as TenantProfile[]);
    if (subsRes.data) setSubscription(subsRes.data as TenantSubscription);
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

  const planLabels: Record<string, string> = {
    voice_start: "Voice Start",
    combo_start: "Combo Start",
    combo_pro: "Combo Pro",
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
            {subscription && (
              <Badge variant={subscription.status === "active" ? "default" : "destructive"}>
                {subscription.status === "active" ? "Attivo" : subscription.status}
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
          <TabsTrigger value="billing">Fatturazione</TabsTrigger>
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
                  <Input value={planLabels[subscription?.plan_code || ""] || subscription?.plan_code || "-"} readOnly className="bg-muted" />
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

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" />Stripe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer ID</Label>
                  <Input value={subscription?.stripe_customer_id || "-"} readOnly className="font-mono bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Subscription ID</Label>
                  <Input value={subscription?.stripe_subscription_id || "-"} readOnly className="font-mono bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Piano</Label>
                  <Input value={planLabels[subscription?.plan_code || ""] || "-"} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Stato</Label>
                  <Input value={subscription?.status || "-"} readOnly className="bg-muted" />
                </div>
              </div>
              {subscription?.period_start && subscription?.period_end && (
                <p className="text-sm text-muted-foreground">
                  Periodo: {new Date(subscription.period_start).toLocaleDateString("it-IT")} — {new Date(subscription.period_end).toLocaleDateString("it-IT")}
                </p>
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
