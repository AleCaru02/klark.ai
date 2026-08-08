import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Phone, MessageCircle, TrendingUp, Calendar, Users, ArrowUpRight, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { Link } from "react-router-dom";

interface TenantInfo {
  id: string;
  name: string;
}

interface DailyVoice {
  date: string;
  connected_seconds: number;
  tenant_id: string;
}

interface DailyWa {
  date: string;
  tenant_id: string;
}

const planLabels: Record<string, string> = {
  essential: "Essential",
  growth: "Growth",
  pro: "Pro",
  enterprise: "Enterprise",
};

export default function Usage() {
  const [period, setPeriod] = useState("month");
  const [selectedTenant, setSelectedTenant] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [voiceData, setVoiceData] = useState<DailyVoice[]>([]);
  const [waData, setWaData] = useState<DailyWa[]>([]);
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const [serviceAccounts, setServiceAccounts] = useState<{ tenant_id: string; plan_code: string; status: string }[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const daysBack = period === "week" ? 7 : period === "month" ? 30 : period === "quarter" ? 90 : 365;
      const startDate = format(subDays(new Date(), daysBack), "yyyy-MM-dd");

      const [tenantsRes, voiceRes, waRes, apptRes, subsRes] = await Promise.all([
        supabase.from("tenants").select("id, name").order("name"),
        supabase.from("usage_voice_daily").select("date, connected_seconds, tenant_id").gte("date", startDate),
        supabase.from("usage_wa_daily").select("date, tenant_id").gte("date", startDate),
        supabase.from("appointments").select("id", { count: "exact", head: true }),
        supabase.from("tenant_service_accounts").select("tenant_id, plan_code, status"),
      ]);

      setTenants((tenantsRes.data || []) as TenantInfo[]);
      setVoiceData((voiceRes.data || []) as DailyVoice[]);
      setWaData((waRes.data || []) as DailyWa[]);
      setAppointmentsCount(apptRes.count || 0);
      setServiceAccounts((subsRes.data || []) as { tenant_id: string; plan_code: string; status: string }[]);
      setLoading(false);
    }
    load();
  }, [period]);

  // Filter by tenant
  const filteredVoice = useMemo(() =>
    selectedTenant === "all" ? voiceData : voiceData.filter((v) => v.tenant_id === selectedTenant),
    [voiceData, selectedTenant]
  );
  const filteredWa = useMemo(() =>
    selectedTenant === "all" ? waData : waData.filter((w) => w.tenant_id === selectedTenant),
    [waData, selectedTenant]
  );

  const totalVoiceMin = Math.round(filteredVoice.reduce((s, v) => s + (v.connected_seconds || 0), 0) / 60);
  const totalWaDays = filteredWa.length;

  // Daily chart data
  const dailyChartData = useMemo(() => {
    const daysBack = period === "week" ? 7 : period === "month" ? 30 : 14;
    const days = eachDayOfInterval({ start: subDays(new Date(), daysBack - 1), end: new Date() });

    return days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const voiceSec = filteredVoice.filter((v) => v.date === dateStr).reduce((s, v) => s + (v.connected_seconds || 0), 0);
      const waCount = filteredWa.filter((w) => w.date === dateStr).length;
      return {
        date: format(day, "d MMM", { locale: it }),
        voice: Math.round(voiceSec / 60),
        whatsapp: waCount,
      };
    });
  }, [filteredVoice, filteredWa, period]);

  // Plan distribution
  const planDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    const seen = new Set<string>();
    serviceAccounts.forEach((s) => {
      if (seen.has(s.tenant_id)) return;
      seen.add(s.tenant_id);
      const plan = s.plan_code || "unknown";
      counts[plan] = (counts[plan] || 0) + 1;
    });
    const colors = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))"];
    return Object.entries(counts).map(([name, value], i) => ({
      name: planLabels[name] || name,
      value,
      color: colors[i % colors.length],
    }));
  }, [serviceAccounts]);

  // Top tenants
  const topTenants = useMemo(() => {
    const map = new Map<string, { voiceSec: number; waDays: number }>();
    voiceData.forEach((v) => {
      const prev = map.get(v.tenant_id) || { voiceSec: 0, waDays: 0 };
      prev.voiceSec += v.connected_seconds || 0;
      map.set(v.tenant_id, prev);
    });
    waData.forEach((w) => {
      const prev = map.get(w.tenant_id) || { voiceSec: 0, waDays: 0 };
      prev.waDays += 1;
      map.set(w.tenant_id, prev);
    });

    return Array.from(map.entries())
      .map(([tid, usage]) => {
        const t = tenants.find((x) => x.id === tid);
        const sub = serviceAccounts.find((s) => s.tenant_id === tid);
        return {
          id: tid,
          name: t?.name || tid.slice(0, 8),
          voiceMin: Math.round(usage.voiceSec / 60),
          waDays: usage.waDays,
          plan: sub?.plan_code || "-",
        };
      })
      .sort((a, b) => b.voiceMin - a.voiceMin)
      .slice(0, 10);
  }, [voiceData, waData, tenants, serviceAccounts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Consumi</h1>
          <p className="text-muted-foreground">Monitoraggio utilizzo piattaforma</p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedTenant} onValueChange={setSelectedTenant}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tutti i tenant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tenant</SelectItem>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Ultima settimana</SelectItem>
              <SelectItem value="month">Ultimo mese</SelectItem>
              <SelectItem value="quarter">Ultimo trimestre</SelectItem>
              <SelectItem value="year">Ultimo anno</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalVoiceMin.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Minuti Voice</p>
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
                <p className="text-2xl font-bold">{totalWaDays.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Giorni WA attivi</p>
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
                <p className="text-2xl font-bold">{appointmentsCount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Appuntamenti</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tenants.length}</p>
                <p className="text-sm text-muted-foreground">Tenant Totali</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Giornaliero</TabsTrigger>
          <TabsTrigger value="distribution">Distribuzione</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />Utilizzo Giornaliero
              </CardTitle>
              <CardDescription>Minuti voice e attività WhatsApp per giorno</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="voice" name="Minuti Voice" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="whatsapp" name="Attività WA" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />Distribuzione Piani
              </CardTitle>
            </CardHeader>
            <CardContent>
              {planDistribution.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nessun dato disponibile</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={planDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {planDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-4">
                    {planDistribution.map((plan) => (
                      <div key={plan.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.color }} />
                        <span className="text-sm">{plan.name}: {plan.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top Tenants */}
      <Card>
        <CardHeader>
          <CardTitle>Top Clienti per Utilizzo</CardTitle>
          <CardDescription>I clienti con maggior consumo nel periodo selezionato</CardDescription>
        </CardHeader>
        <CardContent>
          {topTenants.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nessun dato di utilizzo nel periodo</p>
          ) : (
            <div className="space-y-3">
              {topTenants.map((tenant, index) => (
                <Link
                  key={tenant.id}
                  to={`/admin/tenants/${tenant.id}`}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{tenant.voiceMin} min</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{tenant.waDays} gg</span>
                        <Badge variant="secondary" className="text-xs">{planLabels[tenant.plan] || tenant.plan}</Badge>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
