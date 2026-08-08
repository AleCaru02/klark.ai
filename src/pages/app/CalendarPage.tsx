import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Loader2,
  Clock,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addYears,
  subYears,
  isSameDay,
  isSameMonth,
  startOfYear,
  eachMonthOfInterval,
} from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchIntegrationStatus } from "@/hooks/useIntegrationStatus";
import { useAppointmentOperations } from "@/hooks/useAppointmentOperations";
import { useSyncPolling } from "@/hooks/useSyncPolling";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { AppointmentDetailDialog } from "@/components/appointments/AppointmentDetailDialog";
import { toast } from "sonner";

type ViewMode = "week" | "month" | "year";

interface CalendarAppointment {
  id: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  duration: number;
  status: "scheduled" | "rescheduled" | "canceled" | "confirmed" | "completed" | "no_show";
  hasMeet: boolean;
  meet_link: string | null;
  title?: string;
  description?: string;
  location?: string;
  start_at: string;
  end_at: string;
}

// Status colors for appointments
const statusColors: Record<string, string> = {
  scheduled: "bg-yellow-500",
  confirmed: "bg-green-500",
  cancelled: "bg-red-500",
  canceled: "bg-red-500",
  completed: "bg-blue-500",
  no_show: "bg-orange-500",
  rescheduled: "bg-purple-500",
};

const statusLabels: Record<string, string> = {
  scheduled: "In Attesa",
  confirmed: "Confermato",
  cancelled: "Annullato",
  canceled: "Annullato",
  completed: "Completato",
  no_show: "No Show",
  rescheduled: "Riprogrammato",
};

export default function CalendarPage() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const nav = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const {
    createAppointment,
    rescheduleAppointment,
    cancelAppointment,
    isCreating,
    isRescheduling,
    isCanceling,
  } = useAppointmentOperations();

  // Check Google connection
  useEffect(() => {
    if (!tenantId) return;
    fetchIntegrationStatus()
      .then((status) => setIsGoogleConnected(!!status.google.connected))
      .catch((err) => {
        console.error("Errore stato Google Calendar", err);
        setIsGoogleConnected(false);
      });
  }, [tenantId]);

  // Fetch appointments
  const fetchAppointments = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`id, start_at, end_at, status, meet_link, title, description, location, contact_id, contacts(name, phone_e164)`)
        .eq("tenant_id", tenantId)
        .neq("status", "canceled")
        .order("start_at", { ascending: true });

      if (error) {
        console.error("Error fetching appointments:", error);
        return;
      }

      const formatted: CalendarAppointment[] = (data || []).map((apt) => {
        const startTime = new Date(apt.start_at);
        const endTime = new Date(apt.end_at);
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        const contact = apt.contacts as unknown as { name: string; phone_e164: string } | null;
        const romeOptions = { timeZone: "Europe/Rome" };
        const romeDateStr = startTime.toLocaleDateString("sv-SE", romeOptions);
        const romeTimeStr = startTime.toLocaleTimeString("it-IT", { ...romeOptions, hour: "2-digit", minute: "2-digit" });

        return {
          id: apt.id,
          name: contact?.name || apt.title || "Sconosciuto",
          phone: contact?.phone_e164 || "",
          date: romeDateStr,
          time: romeTimeStr,
          duration: durationMinutes,
          status: (apt.status || "scheduled") as CalendarAppointment["status"],
          hasMeet: !!apt.meet_link,
          meet_link: apt.meet_link,
          title: apt.title,
          description: apt.description,
          location: apt.location,
          start_at: apt.start_at,
          end_at: apt.end_at,
        };
      });

      setAppointments(formatted);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  // Sync polling
  useSyncPolling({
    tenantId,
    enabled: isGoogleConnected,
    intervalMs: 90000,
    onSyncComplete: (result) => {
      if (result?.success) fetchAppointments();
    },
  });

  useEffect(() => {
    if (tenantId) fetchAppointments();
  }, [tenantId, fetchAppointments]);

  // Navigation
  const navigate = (direction: "prev" | "next") => {
    if (viewMode === "week") {
      setCurrentDate(direction === "next" ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else if (viewMode === "month") {
      setCurrentDate(direction === "next" ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    } else {
      setCurrentDate(direction === "next" ? addYears(currentDate, 1) : subYears(currentDate, 1));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const getDateRangeLabel = () => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, "d MMM", { locale: it })} - ${format(end, "d MMM yyyy", { locale: it })}`;
    } else if (viewMode === "month") {
      return format(currentDate, "MMMM yyyy", { locale: it });
    } else {
      return format(currentDate, "yyyy");
    }
  };

  const getAppointmentsForDay = (day: Date): CalendarAppointment[] => {
    const dayStr = format(day, "yyyy-MM-dd");
    return appointments.filter((appt) => appt.date === dayStr);
  };

  const getAppointmentColor = (status: string | null) => {
    return statusColors[status || "scheduled"] || statusColors.scheduled;
  };

  // Dialog handlers
  const handleOpenCreateDialog = (date?: Date) => {
    setSelectedAppointment(null);
    setSelectedDate(date || currentDate);
    setCreateDialogOpen(true);
  };

  const handleAppointmentClick = (appt: CalendarAppointment) => {
    setSelectedAppointment(appt);
    setDetailDialogOpen(true);
  };

  const handleOpenRescheduleDialog = () => {
    setDetailDialogOpen(false);
    setRescheduleDialogOpen(true);
  };

  const handleCancelAppointment = async () => {
    if (!tenantId || !selectedAppointment) return;
    const success = await cancelAppointment({
      tenant_id: tenantId,
      appointment_id: selectedAppointment.id,
      reason: "Cancellazione da app",
    });
    if (success) {
      setDetailDialogOpen(false);
      fetchAppointments();
    }
  };

  const handleCreateSubmit = async (data: {
    title: string;
    description?: string;
    location?: string;
    start_at: string;
    end_at: string;
    create_meet: boolean;
  }) => {
    if (!tenantId) return;
    const result = await createAppointment({ tenant_id: tenantId, ...data });
    if (result) {
      setCreateDialogOpen(false);
      fetchAppointments();
    }
  };

  const handleRescheduleSubmit = async (data: {
    title: string;
    description?: string;
    location?: string;
    start_at: string;
    end_at: string;
    create_meet: boolean;
  }) => {
    if (!tenantId || !selectedAppointment) return;
    const result = await rescheduleAppointment({
      tenant_id: tenantId,
      old_appointment_id: selectedAppointment.id,
      new_start_at: data.start_at,
      new_end_at: data.end_at,
      reason: "Spostamento da calendario",
    });
    if (result) {
      setRescheduleDialogOpen(false);
      fetchAppointments();
    }
  };

  // === RENDER VIEWS (identical to original) ===

  const renderWeekView = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="flex flex-col h-[calc(100vh-280px)]">
        {/* Header with day names */}
        <div className="grid grid-cols-8 border-b">
          <div className="p-2 text-sm text-muted-foreground"></div>
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={`p-2 text-center border-l ${
                isSameDay(day, new Date()) ? "bg-primary/10" : ""
              }`}
            >
              <div className="text-xs text-muted-foreground">
                {format(day, "EEE", { locale: it })}
              </div>
              <div
                className={`text-lg font-semibold ${
                  isSameDay(day, new Date()) ? "text-primary" : ""
                }`}
              >
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-8">
            {hours.map((hour) => (
              <>
                <div
                  key={`hour-${hour}`}
                  className="p-2 text-xs text-muted-foreground text-right pr-4 border-b h-16"
                >
                  {`${hour}:00`}
                </div>
                {days.map((day) => {
                  const dayAppointments = getAppointmentsForDay(day).filter(
                    (appt) => {
                      const [h] = appt.time.split(":").map(Number);
                      return h === hour;
                    }
                  );
                  return (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      className="border-l border-b h-16 relative"
                    >
                      {dayAppointments.map((appt) => {
                        const color = getAppointmentColor(appt.status);

                        return (
                          <div
                            key={appt.id}
                            className={`absolute inset-x-1 top-1 p-1 rounded text-xs text-white cursor-pointer hover:opacity-80 transition-opacity ${color}`}
                            style={{ height: `${Math.max((appt.duration / 60) * 64, 24)}px` }}
                            onClick={() => handleAppointmentClick(appt)}
                          >
                            <div className="font-medium truncate">{appt.title || "Appuntamento"}</div>
                            <div className="opacity-80">{appt.time}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const startWeek = startOfWeek(start, { weekStartsOn: 1 });
    const endWeek = endOfWeek(end, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: startWeek, end: endWeek });
    const weeks = [];

    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <div className="h-[calc(100vh-280px)]">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
            <div key={day} className="p-2 text-center text-sm text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-rows-6 h-[calc(100%-40px)]">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 border-b">
              {week.map((day) => {
                const dayAppointments = getAppointmentsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={day.toISOString()}
                    className={`p-1 border-r min-h-[80px] ${
                      !isCurrentMonth ? "bg-muted/30" : ""
                    } ${isToday ? "bg-primary/5" : ""}`}
                  >
                    <div
                      className={`text-sm mb-1 ${
                        isToday
                          ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center"
                          : !isCurrentMonth
                          ? "text-muted-foreground"
                          : ""
                      }`}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayAppointments.slice(0, 2).map((appt) => (
                        <div
                          key={appt.id}
                          className={`text-xs p-1 rounded truncate text-white cursor-pointer hover:opacity-80 transition-opacity ${getAppointmentColor(appt.status)}`}
                          onClick={() => handleAppointmentClick(appt)}
                        >
                          {appt.title || "Appuntamento"}
                        </div>
                      ))}
                      {dayAppointments.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayAppointments.length - 2} altri
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    const start = startOfYear(currentDate);
    const months = eachMonthOfInterval({
      start,
      end: new Date(currentDate.getFullYear(), 11, 31),
    });

    const getMonthAppointments = (month: Date): CalendarAppointment[] => {
      return appointments.filter((appt) => isSameMonth(new Date(appt.start_at), month));
    };

    return (
      <div className="grid grid-cols-3 md:grid-cols-4 gap-4 h-[calc(100vh-280px)] overflow-y-auto p-2">
        {months.map((month) => {
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);
          const startWeek = startOfWeek(monthStart, { weekStartsOn: 1 });
          const endWeek = endOfWeek(monthEnd, { weekStartsOn: 1 });
          const days = eachDayOfInterval({ start: startWeek, end: endWeek });
          const weeks = [];
          for (let i = 0; i < days.length; i += 7) {
            weeks.push(days.slice(i, i + 7));
          }

          const monthAppointments = getMonthAppointments(month);

          return (
            <Card key={month.toISOString()} className="p-3">
              <h3 className="font-semibold text-sm mb-2 capitalize">
                {format(month, "MMMM", { locale: it })}
              </h3>
              <div className="grid grid-cols-7 gap-px text-xs">
                {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => (
                  <div key={i} className="text-center text-muted-foreground">
                    {d}
                  </div>
                ))}
                {weeks.slice(0, 6).flatMap((week) =>
                  week.map((day) => {
                    const hasAppointment = getAppointmentsForDay(day).length > 0;
                    const isCurrentMonth = isSameMonth(day, month);
                    const isToday = isSameDay(day, new Date());

                    return (
                      <div
                        key={day.toISOString()}
                        className={`text-center p-0.5 ${
                          !isCurrentMonth ? "text-muted-foreground/30" : ""
                        } ${isToday ? "bg-primary text-primary-foreground rounded-full" : ""}
                        ${hasAppointment && !isToday ? "font-bold text-primary" : ""}`}
                      >
                        {format(day, "d")}
                      </div>
                    );
                  })
                )}
              </div>
              {monthAppointments.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {monthAppointments.length} appuntamenti
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendario</h1>
          <p className="text-muted-foreground">
            Visualizza e gestisci i tuoi appuntamenti
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => nav("/app/calendar/availability")}>
            <Clock className="h-4 w-4 mr-2" />
            Disponibilità
          </Button>
          <Button onClick={() => handleOpenCreateDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Nuovo Evento
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={goToToday}>
            Oggi
          </Button>
          <h2 className="text-xl font-semibold capitalize ml-2">
            {getDateRangeLabel()}
          </h2>
        </div>

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="week">Settimana</TabsTrigger>
            <TabsTrigger value="month">Mese</TabsTrigger>
            <TabsTrigger value="year">Anno</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar Content */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {viewMode === "week" && renderWeekView()}
            {viewMode === "month" && renderMonthView()}
            {viewMode === "year" && renderYearView()}
          </>
        )}
      </Card>

      {/* Legend */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center gap-6 flex-wrap">
          <span className="text-sm text-muted-foreground font-medium">Stato:</span>
          {Object.entries(statusLabels).filter(([k]) => k !== "cancelled").map(([status, label]) => (
            <div key={status} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${statusColors[status]}`} />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Create Dialog */}
      <AppointmentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        appointment={null}
        selectedDate={selectedDate}
        onSubmit={handleCreateSubmit}
        isLoading={isCreating}
      />

      {/* Reschedule Dialog */}
      <AppointmentDialog
        open={rescheduleDialogOpen}
        onOpenChange={setRescheduleDialogOpen}
        mode="reschedule"
        appointment={selectedAppointment}
        selectedDate={undefined}
        onSubmit={handleRescheduleSubmit}
        isLoading={isRescheduling}
      />

      {/* Detail Dialog */}
      <AppointmentDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        appointment={selectedAppointment}
        onReschedule={handleOpenRescheduleDialog}
        onCancel={handleCancelAppointment}
        isCanceling={isCanceling}
      />
    </div>
  );
}
