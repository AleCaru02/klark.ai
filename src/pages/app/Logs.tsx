import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  MessageCircle,
  Calendar,
  Search,
  Play,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  FileSpreadsheet,
  FileText as FileTextIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import CallDetailDialog from "@/components/calls/CallDetailDialog";

interface CallLog {
  id: string;
  phone: string;
  contactName: string | null;
  direction: "inbound" | "outbound";
  duration: number;
  createdAt: Date;
  hasRecording: boolean;
  hasTranscript: boolean;
  outcome: string | null;
  recordingUrl: string | null;
  transcript: string | null;
}

interface MessageLog {
  id: string;
  phone: string;
  contactName: string | null;
  template: string | null;
  status: "sent" | "delivered" | "read" | "failed";
  createdAt: Date;
  channel: string;
}

interface CalendarLog {
  id: string;
  contactName: string | null;
  action: string;
  startAt: Date;
  source: string;
  createdAt: Date;
}

export default function Logs() {
  const { membership } = useAuth();
  const [activeTab, setActiveTab] = useState("calls");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [calendarLogs, setCalendarLogs] = useState<CalendarLog[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);

  const tenantId = membership?.tenant_id;

  useEffect(() => {
    if (tenantId) {
      fetchLogs();
    }
  }, [tenantId, activeTab, currentPage]);

  const fetchLogs = async () => {
    if (!tenantId) return;

    setLoading(true);
    try {
      if (activeTab === "calls") {
        const { data, error } = await supabase
          .from("call_logs")
          .select(`
            id,
            created_at,
            direction,
            connected_seconds,
            recording_url,
            transcript,
            outcome_json,
            contact_id,
            contacts(name, phone_e164)
          `)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

        if (error) throw error;

        const formatted: CallLog[] = (data || []).map((log) => {
          const contact = log.contacts as unknown as { name: string; phone_e164: string } | null;
          const outcome = log.outcome_json as {
            action?: string;
            call_status?: string;
            appointment_booked?: boolean;
            handoff_requested?: boolean;
          } | null;

          return {
            id: log.id,
            phone: contact?.phone_e164 || "Sconosciuto",
            contactName: contact?.name || null,
            direction: log.direction || "inbound",
            duration: log.connected_seconds || 0,
            createdAt: new Date(log.created_at),
            hasRecording: !!log.recording_url,
            hasTranscript: !!log.transcript,
            outcome: outcome?.appointment_booked
              ? "appointment_booked"
              : outcome?.handoff_requested
              ? "human_handoff"
              : outcome?.action || outcome?.call_status || null,
            recordingUrl: log.recording_url || null,
            transcript: log.transcript || null,
          };
        });

        setCallLogs(formatted);
      } else if (activeTab === "messages") {
        const { data, error } = await supabase
          .from("message_logs")
          .select(`
            id,
            created_at,
            channel,
            status,
            template_name,
            payload_json,
            contact_id,
            contacts(name, phone_e164)
          `)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

        if (error) throw error;

        const formatted: MessageLog[] = (data || []).map((log) => {
          const contact = log.contacts as unknown as { name: string; phone_e164: string } | null;
          const payload = log.payload_json as { to?: string } | null;

          return {
            id: log.id,
            phone: contact?.phone_e164 || payload?.to || "Sconosciuto",
            contactName: contact?.name || null,
            template: log.template_name,
            status: log.status || "sent",
            createdAt: new Date(log.created_at),
            channel: log.channel || "whatsapp",
          };
        });

        setMessageLogs(formatted);
      } else if (activeTab === "calendar") {
        const { data, error } = await supabase
          .from("appointments")
          .select(`
            id,
            created_at,
            start_at,
            status,
            contact_id,
            contacts(name)
          `)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

        if (error) throw error;

        const formatted: CalendarLog[] = (data || []).map((apt) => {
          const contact = apt.contacts as unknown as { name: string } | null;

          return {
            id: apt.id,
            contactName: contact?.name || "Cliente",
            action: apt.status === "canceled" ? "Cancellato" : apt.status === "rescheduled" ? "Spostato" : "Creato",
            startAt: new Date(apt.start_at),
            source: "Voice",
            createdAt: new Date(apt.created_at),
          };
        });

        setCalendarLogs(formatted);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: "csv" | "pdf") => {
    const now = new Date().toLocaleDateString("it-IT").replace(/\//g, "");
    if (activeTab === "calls") {
      const data = callLogs.map((l) => ({
        contact_name: l.contactName || "",
        phone_e164: l.phone,
        direction: l.direction === "inbound" ? "In arrivo" : "In uscita",
        duration: formatDuration(l.duration),
        outcome: l.outcome || "",
        created_at: formatTime(l.createdAt),
      }));
      if (format === "csv") exportToCSV(data, `chiamate_${now}`);
      else exportToPDF(data, `chiamate_${now}`, "Log Chiamate");
    } else if (activeTab === "messages") {
      const data = messageLogs.map((l) => ({
        contact_name: l.contactName || "",
        phone_e164: l.phone,
        template: l.template || "",
        status: l.status,
        channel: l.channel,
        created_at: formatTime(l.createdAt),
      }));
      if (format === "csv") exportToCSV(data, `messaggi_${now}`);
      else exportToPDF(data, `messaggi_${now}`, "Log Messaggi WhatsApp");
    } else if (activeTab === "calendar") {
      const data = calendarLogs.map((l) => ({
        contact_name: l.contactName || "",
        action: l.action,
        start_at: l.startAt.toLocaleDateString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
        source: l.source,
        created_at: formatTime(l.createdAt),
      }));
      if (format === "csv") exportToCSV(data, `calendario_${now}`);
      else exportToPDF(data, `calendario_${now}`, "Log Eventi Calendario");
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "read":
        return <CheckCircle className="w-4 h-4 text-success" />;
      case "delivered":
        return <CheckCircle className="w-4 h-4 text-primary" />;
      case "sent":
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Log Attività</h1>
          <p className="text-muted-foreground">
            Storico chiamate, messaggi e eventi calendario
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Esporta
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("csv")}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Esporta CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("pdf")}>
              <FileTextIcon className="h-4 w-4 mr-2" />
              Esporta PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }}>
        <TabsList className="mb-6">
          <TabsTrigger value="calls">
            <Phone className="w-4 h-4 mr-2" />
            Chiamate
          </TabsTrigger>
          <TabsTrigger value="messages">
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="w-4 h-4 mr-2" />
            Calendario
          </TabsTrigger>
        </TabsList>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per nome o telefono..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Calls Tab */}
            <TabsContent value="calls">
              {callLogs.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Phone className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">Nessuna chiamata registrata</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {callLogs.map((log) => (
                        <div 
                          key={log.id} 
                          className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setSelectedCall(log)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              log.direction === "inbound" ? "bg-success/10" : "bg-primary/10"
                            )}>
                              <Phone className={cn(
                                "w-4 h-4",
                                log.direction === "inbound" ? "text-success" : "text-primary"
                              )} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{log.contactName || log.phone}</p>
                                <Badge variant="outline" className="text-xs">
                                  {log.direction === "inbound" ? "In arrivo" : "In uscita"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {formatTime(log.createdAt)} • {formatDuration(log.duration)}
                                {log.outcome && ` • ${log.outcome}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {log.hasRecording && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Play className="w-3 h-3" />
                                Audio
                              </Badge>
                            )}
                            {log.hasTranscript && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <FileText className="w-3 h-3" />
                                Chat
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Messages Tab */}
            <TabsContent value="messages">
              {messageLogs.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">Nessun messaggio inviato</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {messageLogs.map((log) => (
                        <div key={log.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                              <MessageCircle className="w-4 h-4 text-success" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{log.contactName || log.phone}</p>
                                {log.template && (
                                  <Badge variant="secondary" className="text-xs">
                                    {log.template}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {formatTime(log.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.status)}
                            <span className="text-sm text-muted-foreground capitalize">{log.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Calendar Tab */}
            <TabsContent value="calendar">
              {calendarLogs.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">Nessun evento calendario</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {calendarLogs.map((log) => (
                        <div key={log.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Calendar className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{log.contactName}</p>
                                <Badge variant={log.action === "Cancellato" ? "destructive" : log.action === "Spostato" ? "secondary" : "default"} className="text-xs">
                                  {log.action}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {log.startAt.toLocaleDateString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                {" • Creato il "}{formatTime(log.createdAt)}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {log.source}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </>
        )}

        {/* Pagination */}
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Precedente
          </Button>
          <div className="px-4 py-2 bg-muted rounded-lg text-sm font-medium">
            Pagina {currentPage}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={
              (activeTab === "calls" && callLogs.length < pageSize) ||
              (activeTab === "messages" && messageLogs.length < pageSize) ||
              (activeTab === "calendar" && calendarLogs.length < pageSize)
            }
          >
            Successiva
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </Tabs>

      {/* Call Detail Dialog */}
      <CallDetailDialog
        open={!!selectedCall}
        onOpenChange={(open) => !open && setSelectedCall(null)}
        callId={selectedCall?.id || null}
        contactName={selectedCall?.contactName || null}
        phone={selectedCall?.phone || ""}
        direction={selectedCall?.direction || "inbound"}
        duration={selectedCall?.duration || 0}
        createdAt={selectedCall?.createdAt || new Date()}
        recordingUrl={selectedCall?.recordingUrl || null}
        transcript={selectedCall?.transcript || null}
        outcome={selectedCall?.outcome || null}
      />
    </div>
  );
}
