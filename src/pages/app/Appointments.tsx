import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchIntegrationStatus } from "@/hooks/useIntegrationStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar, Search, Plus, ChevronLeft, ChevronRight, Loader2, CalendarDays, CalendarRange, CalendarCheck } from "lucide-react";
import { CalendarGrid } from "@/components/appointments/CalendarGrid";
import { SyncStatusBox } from "@/components/appointments/SyncStatusBox";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { AppointmentDetailDialog } from "@/components/appointments/AppointmentDetailDialog";
import { useAppointmentOperations } from "@/hooks/useAppointmentOperations";
import { useSyncPolling } from "@/hooks/useSyncPolling";
import { toast } from "sonner";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";
import { it } from "date-fns/locale";

interface Appointment {
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
}

type ViewType = "month" | "week" | "day";

export default function Appointments() {
  const { membership } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>("month");
  const [isImporting, setIsImporting] = useState(false);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  const { 
    createAppointment, 
    rescheduleAppointment, 
    cancelAppointment,
    isCreating, 
    isRescheduling,
    isCanceling 
  } = useAppointmentOperations();

  const tenantId = membership?.tenant_id;

  // Check Google Calendar connection status
  useEffect(() => {
    async function checkGoogleConnection() {
      if (!tenantId) return;
      try {
        const status = await fetchIntegrationStatus();
        setIsGoogleConnected(!!status.google.connected);
      } catch (err) {
        console.error("Errore stato Google Calendar", err);
        setIsGoogleConnected(false);
      }
    }
    checkGoogleConnection();
  }, [tenantId]);

  const fetchAppointments = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    try {
      let startDate: Date;
      let endDate: Date;

      if (view === "month") {
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
      } else if (view === "week") {
        const dayOfWeek = currentDate.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - diff);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else {
        startDate = new Date(currentDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(currentDate);
        endDate.setHours(23, 59, 59, 999);
      }

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          start_at,
          end_at,
          status,
          meet_link,
          title,
          description,
          location,
          contact_id,
          contacts(name, phone_e164)
        `)
        .eq("tenant_id", tenantId)
        .gte("start_at", startDate.toISOString())
        .lte("start_at", endDate.toISOString())
        .neq("status", "canceled")
        .order("start_at", { ascending: true });

      if (error) {
        console.error("Error fetching appointments:", error);
        return;
      }

      const formattedAppointments: Appointment[] = (data || []).map((apt) => {
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
          status: apt.status || "scheduled",
          hasMeet: !!apt.meet_link,
          meet_link: apt.meet_link,
          title: apt.title,
          description: apt.description,
          location: apt.location,
        };
      });

      setAppointments(formattedAppointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoading(false);
    }
  }, [tenantId, currentDate, view]);

  // Setup sync polling - runs every 90 seconds when Google is connected
  const { syncNow, isSyncing, lastSyncResult, lastSyncError } = useSyncPolling({
    tenantId,
    enabled: isGoogleConnected,
    intervalMs: 90000,
    onSyncComplete: (result) => {
      if (result?.success) {
        // Refresh appointments after sync
        fetchAppointments();
      }
    },
  });

  useEffect(() => {
    if (tenantId) {
      fetchAppointments();
    }
  }, [tenantId, fetchAppointments]);

  const handleImport = async () => {
    if (!tenantId) return;

    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-import", {
        body: { 
          tenant_id: tenantId,
          days_past: 60,
          days_future: 365
        },
      });

      if (error) {
        console.error("Import error:", error);
        toast.error("Errore durante l'importazione");
        return;
      }

      if (data?.success) {
        const { stats } = data;
        toast.success(
          `Importazione completata: ${stats.imported} nuovi, ${stats.updated} aggiornati, ${stats.skipped} già presenti`
        );
        fetchAppointments();
      } else {
        toast.error(data?.error || "Errore durante l'importazione");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Errore durante l'importazione");
    } finally {
      setIsImporting(false);
    }
  };

  // Create dialog handlers
  const handleOpenCreateDialog = (date?: Date) => {
    setSelectedAppointment(null);
    setSelectedDate(date || currentDate);
    setCreateDialogOpen(true);
  };

  // Detail dialog handlers
  const handleOpenDetailDialog = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setDetailDialogOpen(true);
  };

  // Reschedule handlers
  const handleOpenRescheduleDialog = () => {
    setDetailDialogOpen(false);
    setRescheduleDialogOpen(true);
  };

  // Cancel handler
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

  // Create submit
  const handleCreateSubmit = async (data: {
    title: string;
    description?: string;
    location?: string;
    start_at: string;
    end_at: string;
    create_meet: boolean;
  }) => {
    if (!tenantId) return;

    const result = await createAppointment({
      tenant_id: tenantId,
      ...data,
    });
    if (result) {
      setCreateDialogOpen(false);
      fetchAppointments();
    }
  };

  // Reschedule submit
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

  const filteredAppointments = appointments.filter((apt) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return apt.name.toLowerCase().includes(query) || apt.phone.includes(query);
  });

  const navigateDate = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      if (view === "month") {
        return direction === "next" ? addMonths(prev, 1) : subMonths(prev, 1);
      } else if (view === "week") {
        return direction === "next" ? addWeeks(prev, 1) : subWeeks(prev, 1);
      } else {
        return direction === "next" ? addDays(prev, 1) : subDays(prev, 1);
      }
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    setCurrentDate(date);
    if (view === "month") {
      setView("day");
    }
  };

  const getDateLabel = () => {
    if (view === "month") {
      return format(currentDate, "MMMM yyyy", { locale: it });
    } else if (view === "week") {
      const dayOfWeek = currentDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - diff);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${format(weekStart, "d MMM", { locale: it })} - ${format(weekEnd, "d MMM yyyy", { locale: it })}`;
    } else {
      return format(currentDate, "EEEE d MMMM yyyy", { locale: it });
    }
  };

  if (loading && appointments.length === 0) {
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
          <h1 className="text-2xl font-bold mb-1">Appuntamenti</h1>
          <p className="text-muted-foreground">
            Visualizza e gestisci gli appuntamenti del tuo calendario
          </p>
        </div>
        <Button onClick={() => handleOpenCreateDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Appuntamento
        </Button>
      </div>

      {/* Sync Status Box */}
      <SyncStatusBox
        appointmentsCount={appointments.length}
        onImportClick={handleImport}
        isImporting={isImporting}
        onSyncNowClick={syncNow}
        isSyncing={isSyncing}
        lastSyncResult={lastSyncResult}
        lastSyncError={lastSyncError}
      />

      {/* Calendar Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per nome o telefono..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* View Toggle */}
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(value) => value && setView(value as ViewType)}
              className="justify-start"
            >
              <ToggleGroupItem value="month" aria-label="Vista mese">
                <CalendarDays className="w-4 h-4 mr-2" />
                Mese
              </ToggleGroupItem>
              <ToggleGroupItem value="week" aria-label="Vista settimana">
                <CalendarRange className="w-4 h-4 mr-2" />
                Settimana
              </ToggleGroupItem>
              <ToggleGroupItem value="day" aria-label="Vista giorno">
                <CalendarCheck className="w-4 h-4 mr-2" />
                Giorno
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Oggi
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="px-4 py-2 bg-muted rounded-lg font-medium text-sm min-w-[180px] text-center capitalize">
                {getDateLabel()}
              </div>
              <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <CalendarGrid
        currentDate={currentDate}
        appointments={filteredAppointments}
        view={view}
        onDateClick={handleDateClick}
        onAppointmentClick={handleOpenDetailDialog}
      />

      {/* Empty state for no appointments */}
      {appointments.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">
              Nessun appuntamento trovato per questo periodo
            </p>
            <p className="text-sm text-muted-foreground">
              Usa il box "Stato Sync" in alto per importare eventi da Google Calendar
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Appointment Dialog */}
      <AppointmentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        appointment={null}
        selectedDate={selectedDate}
        onSubmit={handleCreateSubmit}
        isLoading={isCreating}
      />

      {/* Reschedule Appointment Dialog */}
      <AppointmentDialog
        open={rescheduleDialogOpen}
        onOpenChange={setRescheduleDialogOpen}
        mode="reschedule"
        appointment={selectedAppointment}
        selectedDate={undefined}
        onSubmit={handleRescheduleSubmit}
        isLoading={isRescheduling}
      />

      {/* Appointment Detail Dialog */}
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
