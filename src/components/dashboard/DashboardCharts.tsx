import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Loader2 } from "lucide-react";

interface DailyData {
  date: string;
  label: string;
  calls: number;
  appointments: number;
  messages: number;
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

const COLORS = [
  "hsl(220, 70%, 45%)",  // primary
  "hsl(175, 65%, 30%)",  // accent
  "hsl(160, 70%, 40%)",  // success
  "hsl(38, 92%, 50%)",   // warning
  "hsl(0, 84%, 60%)",    // destructive
  "hsl(220, 15%, 45%)",  // muted
];

export function DashboardCharts() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [appointmentStatuses, setAppointmentStatuses] = useState<StatusData[]>([]);

  useEffect(() => {
    if (tenantId) fetchChartData();
  }, [tenantId]);

  const fetchChartData = async () => {
    if (!tenantId) return;
    setLoading(true);

    try {
      const now = new Date();
      const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [callsRes, appointmentsRes, messagesRes] = await Promise.all([
        supabase
          .from("call_logs")
          .select("id, created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", days30.toISOString()),
        supabase
          .from("appointments")
          .select("id, created_at, status")
          .eq("tenant_id", tenantId)
          .gte("created_at", days30.toISOString()),
        supabase
          .from("message_logs")
          .select("id, created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", days30.toISOString()),
      ]);

      // Build daily data for last 14 days
      const days: DailyData[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const label = d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });

        const calls = (callsRes.data || []).filter(
          (c) => c.created_at.startsWith(dateStr)
        ).length;
        const appointments = (appointmentsRes.data || []).filter(
          (a) => a.created_at.startsWith(dateStr)
        ).length;
        const messages = (messagesRes.data || []).filter(
          (m) => m.created_at.startsWith(dateStr)
        ).length;

        days.push({ date: dateStr, label, calls, appointments, messages });
      }
      setDailyData(days);

      // Appointment status breakdown
      const statusMap: Record<string, number> = {};
      (appointmentsRes.data || []).forEach((a) => {
        const s = a.status || "scheduled";
        statusMap[s] = (statusMap[s] || 0) + 1;
      });

      const statusLabels: Record<string, string> = {
        scheduled: "Programmati",
        confirmed: "Confermati",
        completed: "Completati",
        canceled: "Cancellati",
        rescheduled: "Spostati",
        no_show: "No-show",
      };

      const statuses: StatusData[] = Object.entries(statusMap).map(([key, value], i) => ({
        name: statusLabels[key] || key,
        value,
        color: COLORS[i % COLORS.length],
      }));
      setAppointmentStatuses(statuses);
    } catch (error) {
      console.error("Error fetching chart data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasData = dailyData.some((d) => d.calls > 0 || d.appointments > 0 || d.messages > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Attività ultimi 14 giorni</CardTitle>
          <CardDescription>I grafici appariranno quando ci saranno dati</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3v18h18" />
              <path d="M7 16l4-8 4 4 4-6" />
            </svg>
          </div>
          <p className="text-sm font-medium">Nessuna attività ancora</p>
          <p className="text-xs mt-1">Inizia a usare ClerkAI per vedere le statistiche</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Activity Trend - takes 2 cols */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Andamento attività</CardTitle>
          <CardDescription>Ultimi 14 giorni</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="area">
            <TabsList className="mb-4">
              <TabsTrigger value="area">Area</TabsTrigger>
              <TabsTrigger value="bar">Barre</TabsTrigger>
            </TabsList>
            <TabsContent value="area">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(220, 70%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(220, 70%, 45%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAppts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(160, 70%, 40%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(160, 70%, 40%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMsgs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(175, 65%, 30%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(175, 65%, 30%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(220, 15%, 60%)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(220, 15%, 60%)" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid hsl(220, 20%, 88%)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="calls" name="Chiamate" stroke="hsl(220, 70%, 45%)" fill="url(#colorCalls)" strokeWidth={2} />
                  <Area type="monotone" dataKey="appointments" name="Appuntamenti" stroke="hsl(160, 70%, 40%)" fill="url(#colorAppts)" strokeWidth={2} />
                  <Area type="monotone" dataKey="messages" name="Messaggi" stroke="hsl(175, 65%, 30%)" fill="url(#colorMsgs)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </TabsContent>
            <TabsContent value="bar">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(220, 15%, 60%)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(220, 15%, 60%)" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid hsl(220, 20%, 88%)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="calls" name="Chiamate" fill="hsl(220, 70%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="appointments" name="Appuntamenti" fill="hsl(160, 70%, 40%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="messages" name="Messaggi" fill="hsl(175, 65%, 30%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Appointment Status Pie */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stato Appuntamenti</CardTitle>
          <CardDescription>Distribuzione 30 giorni</CardDescription>
        </CardHeader>
        <CardContent>
          {appointmentStatuses.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={appointmentStatuses}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {appointmentStatuses.map((entry, i) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid hsl(220, 20%, 88%)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {appointmentStatuses.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-muted-foreground">{s.name}</span>
                    </div>
                    <span className="font-semibold">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nessun appuntamento nel periodo
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
