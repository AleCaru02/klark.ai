import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Calendar, MessageCircle, Clock, TrendingUp, ArrowRight, Loader2, PhoneOutgoing, PhoneIncoming } from "lucide-react";
import { Link } from "react-router-dom";
import { IntegrationStatus } from "@/components/dashboard/IntegrationStatus";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";

interface DashboardStats {
  voiceMinutesUsed: number;
  voiceMinutesTotal: number;
  appointmentsToday: number;
  nextAppointmentTime: string | null;
  messagesThisMonth: number;
  avgCallDuration: string;
  callsMade: number;
  callsReceived: number;
  appointmentsThisWeek: number;
  appointmentsThisMonth: number;
  appointmentsThisYear: number;
}

interface RecentCall {
  id: string;
  phone: string;
  duration: string;
  time: string;
  action: string;
}

interface UpcomingAppointment {
  id: string;
  name: string;
  type: string;
  time: string;
  timeLabel: string;
  isNext: boolean;
}

const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMins < 60) return `${diffMins} min fa`;
  if (diffHours < 24) return `${diffHours} ore fa`;
  return `${diffDays} giorni fa`;
};

export default function AppOverview() {
  const { user, membership } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    voiceMinutesUsed: 0, voiceMinutesTotal: 200, appointmentsToday: 0,
    nextAppointmentTime: null, messagesThisMonth: 0, avgCallDuration: "0:00",
    callsMade: 0, callsReceived: 0, appointmentsThisWeek: 0,
    appointmentsThisMonth: 0, appointmentsThisYear: 0,
  });
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);

  const tenantId = membership?.tenant_id;

  useEffect(() => {
    if (tenantId) fetchDashboardData();
  }, [tenantId]);

  const fetchDashboardData = async () => {
    if (!tenantId) return;
    try {
      const now = new Date();
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: voiceData } = await supabase
        .from("usage_voice_daily").select("connected_seconds")
        .eq("tenant_id", tenantId).gte("date", quarterStart.toISOString().split("T")[0]);

      const totalVoiceSeconds = (voiceData || []).reduce((sum, row) => sum + (row.connected_seconds || 0), 0);

      const { data: subscription } = await supabase
        .from("subscriptions").select("plan_code")
        .eq("tenant_id", tenantId).eq("status", "active").single();

      let includedMinutes = 200;
      if (subscription?.plan_code) {
        const { data: plan } = await supabase.from("plans")
          .select("included_connected_seconds_per_quarter")
          .eq("code", subscription.plan_code).single();
        if (plan) includedMinutes = Math.ceil(plan.included_connected_seconds_per_quarter / 60);
      }

      const [todayRes, upcomingRes, messagesRes, callsRes, outboundRes, inboundRes] = await Promise.all([
        supabase.from("appointments").select("id, start_at, status, contact_id, contacts(name)")
          .eq("tenant_id", tenantId).gte("start_at", todayStart.toISOString())
          .lt("start_at", new Date(todayStart.getTime() + 86400000).toISOString())
          .neq("status", "canceled").order("start_at"),
        supabase.from("appointments").select("id, start_at, status, contact_id, contacts(name)")
          .eq("tenant_id", tenantId).gte("start_at", now.toISOString())
          .lt("start_at", new Date(now.getTime() + 7 * 86400000).toISOString())
          .neq("status", "canceled").order("start_at").limit(5),
        supabase.from("message_logs").select("id").eq("tenant_id", tenantId)
          .gte("created_at", monthStart.toISOString()),
        supabase.from("call_logs")
          .select("id, created_at, connected_seconds, direction, contact_id, outcome_json, contacts(name, phone_e164)")
          .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(5),
        supabase.from("call_logs").select("id").eq("tenant_id", tenantId).eq("direction", "outbound"),
        supabase.from("call_logs").select("id").eq("tenant_id", tenantId).eq("direction", "inbound"),
      ]);

      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const [weekRes, monthRes, yearRes] = await Promise.all([
        supabase.from("appointments").select("id").eq("tenant_id", tenantId)
          .gte("created_at", weekStart.toISOString()).neq("status", "canceled"),
        supabase.from("appointments").select("id").eq("tenant_id", tenantId)
          .gte("created_at", monthStart.toISOString()).neq("status", "canceled"),
        supabase.from("appointments").select("id").eq("tenant_id", tenantId)
          .gte("created_at", yearStart.toISOString()).neq("status", "canceled"),
      ]);

      const callsData = callsRes.data || [];
      let avgSeconds = 0;
      if (callsData.length > 0) {
        avgSeconds = Math.round(callsData.reduce((sum, c) => sum + (c.connected_seconds || 0), 0) / callsData.length);
      }

      const formattedCalls: RecentCall[] = callsData.map((call) => {
        const mins = Math.floor((call.connected_seconds || 0) / 60);
        const secs = (call.connected_seconds || 0) % 60;
        const contact = call.contacts as unknown as { name: string; phone_e164: string } | null;
        const outcome = call.outcome_json as { action?: string } | null;
        return {
          id: call.id,
          phone: contact?.phone_e164 || "Sconosciuto",
          duration: `${mins}:${secs.toString().padStart(2, "0")}`,
          time: getTimeAgo(new Date(call.created_at)),
          action: outcome?.action || (call.direction === "inbound" ? "In arrivo" : "In uscita"),
        };
      });

      const formattedAppointments: UpcomingAppointment[] = (upcomingRes.data || []).map((apt, index) => {
        const startTime = new Date(apt.start_at);
        const contact = apt.contacts as unknown as { name: string } | null;
        const hoursUntil = Math.round((startTime.getTime() - now.getTime()) / 3600000);
        return {
          id: apt.id, name: contact?.name || "Cliente", type: "Appuntamento",
          time: startTime.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
          timeLabel: hoursUntil <= 24 ? (hoursUntil <= 0 ? "Ora" : `Tra ${hoursUntil}h`) :
            startTime.toLocaleDateString("it-IT", { weekday: "short", day: "numeric" }),
          isNext: index === 0,
        };
      });

      const nextApt = todayRes.data?.find((a) => new Date(a.start_at) > now);

      setStats({
        voiceMinutesUsed: Math.ceil(totalVoiceSeconds / 60),
        voiceMinutesTotal: includedMinutes,
        appointmentsToday: todayRes.data?.length || 0,
        nextAppointmentTime: nextApt ? new Date(nextApt.start_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : null,
        messagesThisMonth: messagesRes.data?.length || 0,
        avgCallDuration: `${Math.floor(avgSeconds / 60)}:${(avgSeconds % 60).toString().padStart(2, "0")}`,
        callsMade: outboundRes.data?.length || 0,
        callsReceived: inboundRes.data?.length || 0,
        appointmentsThisWeek: weekRes.data?.length || 0,
        appointmentsThisMonth: monthRes.data?.length || 0,
        appointmentsThisYear: yearRes.data?.length || 0,
      });
      setRecentCalls(formattedCalls);
      setUpcomingAppointments(formattedAppointments);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
        <h1 className="text-2xl font-bold mb-1">
          Ciao, {user?.user_metadata?.full_name?.split(" ")[0] || "utente"} 👋
        </h1>
        <p className="text-muted-foreground">
          Ecco un riepilogo dell'attività della tua segretaria AI
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/app/onboarding">
            <TrendingUp className="w-4 h-4 mr-2" />
            Completa Setup
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/app/tests">
            Testa la Segretaria
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Chiamate Effettuate</CardDescription>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <PhoneOutgoing className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{stats.callsMade}</span>
            <p className="text-xs text-muted-foreground mt-1">totale</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Chiamate Ricevute</CardDescription>
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <PhoneIncoming className="w-4 h-4 text-accent" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{stats.callsReceived}</span>
            <p className="text-xs text-muted-foreground mt-1">totale</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Appuntamenti Settimana</CardDescription>
              <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-success" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{stats.appointmentsThisWeek}</span>
            <p className="text-xs text-muted-foreground mt-1">questa settimana</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Appuntamenti Mese</CardDescription>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{stats.appointmentsThisMonth}</span>
            <p className="text-xs text-muted-foreground mt-1">questo mese</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Appuntamenti Anno</CardDescription>
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-accent" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{stats.appointmentsThisYear}</span>
            <p className="text-xs text-muted-foreground mt-1">totale anno</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Minuti Voice</CardDescription>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Phone className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">{stats.voiceMinutesUsed}</span>
              <span className="text-muted-foreground text-sm">/ {stats.voiceMinutesTotal} min</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Messaggi WhatsApp</CardDescription>
              <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-success" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{stats.messagesThisMonth}</span>
            <p className="text-xs text-muted-foreground mt-1">questo mese</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Tempo Medio Chiamata</CardDescription>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{stats.avgCallDuration}</span>
            <p className="text-xs text-muted-foreground mt-1">minuti</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity + Integration Status */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Calls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chiamate Recenti</CardTitle>
            <CardDescription>
              {recentCalls.length > 0 ? `Ultime ${recentCalls.length} chiamate gestite` : "Nessuna chiamata recente"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentCalls.length > 0 ? (
              <div className="space-y-4">
                {recentCalls.map((call) => (
                  <div key={call.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{call.phone}</p>
                        <p className="text-xs text-muted-foreground">{call.time}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{call.duration}</p>
                      <p className="text-xs text-muted-foreground">{call.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nessuna chiamata ancora</p>
              </div>
            )}
            <Button variant="ghost" className="w-full mt-4" asChild>
              <Link to="/app/logs">
                Vedi tutte le chiamate
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prossimi Appuntamenti</CardTitle>
            <CardDescription>
              {upcomingAppointments.length > 0 ? "I tuoi impegni" : "Nessun appuntamento programmato"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length > 0 ? (
              <div className="space-y-4">
                {upcomingAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      apt.isNext ? "bg-accent/10 border border-accent/20" : "bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${apt.isNext ? "bg-accent/20" : "bg-primary/10"} flex items-center justify-center`}>
                        <Calendar className={`w-4 h-4 ${apt.isNext ? "text-accent" : "text-primary"}`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{apt.name}</p>
                        <p className="text-xs text-muted-foreground">{apt.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{apt.time}</p>
                      <p className={`text-xs ${apt.isNext ? "text-accent font-medium" : "text-muted-foreground"}`}>
                        {apt.timeLabel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nessun appuntamento in programma</p>
              </div>
            )}
            <Button variant="ghost" className="w-full mt-4" asChild>
              <Link to="/app/calendar">
                Vedi calendario
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Integration Status */}
        <IntegrationStatus />
      </div>

      {/* Charts */}
      <DashboardCharts />
    </div>
  );
}
