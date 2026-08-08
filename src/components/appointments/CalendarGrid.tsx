import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { it } from "date-fns/locale";

interface Appointment {
  id: string;
  name: string;
  time: string;
  status: "scheduled" | "rescheduled" | "canceled" | "confirmed" | "completed" | "no_show";
  date: string;
  title?: string;
  description?: string;
  location?: string;
  duration?: number;
  hasMeet?: boolean;
  meet_link?: string | null;
  phone?: string;
}

interface CalendarGridProps {
  currentDate: Date;
  appointments: Appointment[];
  view: "month" | "week" | "day";
  onDateClick?: (date: Date) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-primary/80 text-primary-foreground",
  rescheduled: "bg-warning/80 text-warning-foreground",
  canceled: "bg-destructive/80 text-destructive-foreground line-through",
  confirmed: "bg-green-600/80 text-white",
  completed: "bg-blue-600/80 text-white",
  no_show: "bg-orange-600/80 text-white",
};

const TIMEZONE = "Europe/Rome";

function toRomeTime(date: Date): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: TIMEZONE }));
}

export function CalendarGrid({ currentDate, appointments, view, onDateClick, onAppointmentClick }: CalendarGridProps) {
  const days = useMemo(() => {
    const romeDate = toRomeTime(currentDate);
    
    if (view === "month") {
      const monthStart = startOfMonth(romeDate);
      const monthEnd = endOfMonth(romeDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } else if (view === "week") {
      const weekStart = startOfWeek(romeDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(romeDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      return [romeDate];
    }
  }, [currentDate, view]);

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach((apt) => {
      const dateKey = apt.date;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(apt);
    });
    return map;
  }, [appointments]);

  const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  if (view === "day") {
    const dayStr = format(days[0], "yyyy-MM-dd");
    const dayAppointments = appointmentsByDate[dayStr] || [];
    const hours = Array.from({ length: 24 }, (_, i) => i); // 0:00 - 23:00

    return (
      <div className="border rounded-lg bg-card">
        <div className="p-4 border-b bg-muted/50">
          <h3 className="font-semibold text-lg capitalize">
            {format(days[0], "EEEE d MMMM yyyy", { locale: it })}
          </h3>
        </div>
        <div className="divide-y">
          {hours.map((hour) => {
            const hourStr = `${hour.toString().padStart(2, "0")}:`;
            const hourAppointments = dayAppointments.filter((apt) => apt.time.startsWith(hourStr));

            return (
              <div key={hour} className="flex min-h-[60px]">
                <div className="w-16 p-2 text-sm text-muted-foreground border-r bg-muted/30">
                  {hour}:00
                </div>
                <div className="flex-1 p-2 space-y-1">
                  {hourAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className={cn(
                        "px-2 py-1 rounded text-sm cursor-pointer hover:opacity-80 transition-opacity",
                        statusColors[apt.status]
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppointmentClick?.(apt);
                      }}
                    >
                      <span className="font-medium">{apt.time}</span> - {apt.name}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "week") {
    const hours = Array.from({ length: 24 }, (_, i) => i); // 0:00 - 23:00

    return (
      <div className="border rounded-lg bg-card overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-8 border-b bg-muted/50">
          <div className="p-2 border-r" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "p-2 text-center border-r last:border-r-0",
                isToday(day) && "bg-primary/10"
              )}
            >
              <div className="text-xs text-muted-foreground">
                {format(day, "EEE", { locale: it })}
              </div>
              <div className={cn(
                "text-lg font-semibold",
                isToday(day) && "text-primary"
              )}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>
        {/* Time grid */}
        <div className="divide-y max-h-[600px] overflow-y-auto">
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 min-h-[50px]">
              <div className="p-1 text-xs text-muted-foreground border-r bg-muted/30 flex items-start justify-end pr-2">
                {hour}:00
              </div>
              {days.map((day) => {
                const dayStr = format(day, "yyyy-MM-dd");
                const hourStr = `${hour.toString().padStart(2, "0")}:`;
                const hourAppointments = (appointmentsByDate[dayStr] || []).filter(
                  (apt) => apt.time.startsWith(hourStr)
                );

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-r last:border-r-0 p-0.5",
                      isToday(day) && "bg-primary/5"
                    )}
                    onClick={() => onDateClick?.(day)}
                  >
                    {hourAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        className={cn(
                          "px-1 py-0.5 rounded text-xs truncate cursor-pointer hover:opacity-80 transition-opacity",
                          statusColors[apt.status]
                        )}
                        title={`${apt.time} - ${apt.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAppointmentClick?.(apt);
                        }}
                      >
                        {apt.name}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Month view
  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {weekDays.map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const dayAppointments = appointmentsByDate[dayStr] || [];
          const isCurrentMonth = isSameMonth(day, currentDate);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[100px] border-b border-r p-1 cursor-pointer hover:bg-muted/50 transition-colors",
                !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                (idx + 1) % 7 === 0 && "border-r-0",
                idx >= days.length - 7 && "border-b-0"
              )}
              onClick={() => onDateClick?.(day)}
            >
              <div
                className={cn(
                  "text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full",
                  isToday(day) && "bg-primary text-primary-foreground"
                )}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayAppointments.slice(0, 3).map((apt) => (
                  <div
                    key={apt.id}
                    className={cn(
                      "px-1 py-0.5 rounded text-xs truncate cursor-pointer hover:opacity-80 transition-opacity",
                      statusColors[apt.status]
                    )}
                    title={`${apt.time} - ${apt.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick?.(apt);
                    }}
                  >
                    {apt.time} {apt.name}
                  </div>
                ))}
                {dayAppointments.length > 3 && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayAppointments.length - 3} altri
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
