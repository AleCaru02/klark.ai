import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Loader2, Clock, CalendarDays, Shield, Plus, X, Save } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DayAvailability {
  start: string;
  end: string;
}

interface AvailabilityJson {
  monday?: DayAvailability;
  tuesday?: DayAvailability;
  wednesday?: DayAvailability;
  thursday?: DayAvailability;
  friday?: DayAvailability;
  saturday?: DayAvailability;
  sunday?: DayAvailability;
}

interface BookingRules {
  slot_duration_minutes: number;
  min_notice_hours: number;
  max_advance_days: number;
  buffer_minutes?: number;
}

const DAYS_MAP: { key: keyof AvailabilityJson; label: string }[] = [
  { key: "monday", label: "Lunedì" },
  { key: "tuesday", label: "Martedì" },
  { key: "wednesday", label: "Mercoledì" },
  { key: "thursday", label: "Giovedì" },
  { key: "friday", label: "Venerdì" },
  { key: "saturday", label: "Sabato" },
  { key: "sunday", label: "Domenica" },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${h.toString().padStart(2, "0")}:${m}`;
});

export default function Availability() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityJson>({});
  const [activeDays, setActiveDays] = useState<Record<string, boolean>>({});
  const [bookingRules, setBookingRules] = useState<BookingRules>({
    slot_duration_minutes: 30,
    min_notice_hours: 24,
    max_advance_days: 30,
    buffer_minutes: 10,
  });
  const [excludedDates, setExcludedDates] = useState<Date[]>([]);
  const [excludePickerOpen, setExcludePickerOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("settings")
        .select("availability_json, booking_rules_json")
        .eq("tenant_id", tenantId)
        .single();

      if (error) {
        console.error("Error loading settings:", error);
        setLoading(false);
        return;
      }

      const avail = (data?.availability_json as unknown as AvailabilityJson) || {};
      const rules = (data?.booking_rules_json as unknown as BookingRules & { excluded_dates?: string[] }) || {} as any;

      setAvailability(avail);

      const active: Record<string, boolean> = {};
      DAYS_MAP.forEach(({ key }) => {
        active[key] = !!avail[key];
      });
      setActiveDays(active);

      setBookingRules({
        slot_duration_minutes: rules.slot_duration_minutes || 30,
        min_notice_hours: rules.min_notice_hours || 24,
        max_advance_days: rules.max_advance_days || 30,
        buffer_minutes: rules.buffer_minutes || 10,
      });

      if (rules.excluded_dates) {
        setExcludedDates(rules.excluded_dates.map((d: string) => new Date(d)));
      }

      setLoading(false);
    }
    load();
  }, [tenantId]);

  const toggleDay = (dayKey: string) => {
    const newActive = { ...activeDays, [dayKey]: !activeDays[dayKey] };
    setActiveDays(newActive);

    if (!newActive[dayKey]) {
      const newAvail = { ...availability };
      delete newAvail[dayKey as keyof AvailabilityJson];
      setAvailability(newAvail);
    } else if (!availability[dayKey as keyof AvailabilityJson]) {
      setAvailability({
        ...availability,
        [dayKey]: { start: "09:00", end: "18:00" },
      });
    }
  };

  const updateDayTime = (dayKey: string, field: "start" | "end", value: string) => {
    setAvailability({
      ...availability,
      [dayKey]: {
        ...(availability[dayKey as keyof AvailabilityJson] || { start: "09:00", end: "18:00" }),
        [field]: value,
      },
    });
  };

  const addExcludedDate = (date: Date | undefined) => {
    if (!date) return;
    if (!excludedDates.find((d) => d.toDateString() === date.toDateString())) {
      setExcludedDates([...excludedDates, date]);
    }
    setExcludePickerOpen(false);
  };

  const removeExcludedDate = (index: number) => {
    setExcludedDates(excludedDates.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);

    // Build clean availability (only active days)
    const cleanAvail: AvailabilityJson = {};
    DAYS_MAP.forEach(({ key }) => {
      if (activeDays[key] && availability[key]) {
        cleanAvail[key] = availability[key];
      }
    });

    const rulesPayload = {
      ...bookingRules,
      excluded_dates: excludedDates.map((d) => format(d, "yyyy-MM-dd")),
    };

    const { error } = await supabase
      .from("settings")
      .update({
        availability_json: cleanAvail as any,
        booking_rules_json: rulesPayload as any,
      })
      .eq("tenant_id", tenantId);

    setSaving(false);
    if (error) {
      toast.error("Errore nel salvataggio");
      console.error(error);
    } else {
      toast.success("Disponibilità salvata");
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
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Disponibilità</h1>
          <p className="text-muted-foreground">
            Configura gli orari in cui l'AI può fissare appuntamenti
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salva
        </Button>
      </div>

      {/* Weekly Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Orari Settimanali
          </CardTitle>
          <CardDescription>
            Attiva/disattiva i giorni e imposta la fascia oraria disponibile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS_MAP.map(({ key, label }) => {
            const isActive = activeDays[key];
            const day = availability[key];

            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-lg border transition-colors",
                  isActive ? "bg-card border-border" : "bg-muted/30 border-transparent"
                )}
              >
                <Switch checked={isActive} onCheckedChange={() => toggleDay(key)} />
                <span className="font-medium w-24">{label}</span>

                {isActive ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Select
                      value={day?.start || "09:00"}
                      onValueChange={(v) => updateDayTime(key, "start", v)}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">—</span>
                    <Select
                      value={day?.end || "18:00"}
                      onValueChange={(v) => updateDayTime(key, "end", v)}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Non disponibile</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Booking Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Regole di Prenotazione
          </CardTitle>
          <CardDescription>
            Definisci durata slot, buffer e limiti di prenotazione
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Durata Slot</Label>
              <Select
                value={String(bookingRules.slot_duration_minutes)}
                onValueChange={(v) =>
                  setBookingRules({ ...bookingRules, slot_duration_minutes: Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minuti</SelectItem>
                  <SelectItem value="30">30 minuti</SelectItem>
                  <SelectItem value="45">45 minuti</SelectItem>
                  <SelectItem value="60">60 minuti</SelectItem>
                  <SelectItem value="90">90 minuti</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Buffer tra appuntamenti</Label>
              <Select
                value={String(bookingRules.buffer_minutes || 0)}
                onValueChange={(v) =>
                  setBookingRules({ ...bookingRules, buffer_minutes: Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Nessuno</SelectItem>
                  <SelectItem value="5">5 minuti</SelectItem>
                  <SelectItem value="10">10 minuti</SelectItem>
                  <SelectItem value="15">15 minuti</SelectItem>
                  <SelectItem value="30">30 minuti</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Preavviso minimo</Label>
              <Select
                value={String(bookingRules.min_notice_hours)}
                onValueChange={(v) =>
                  setBookingRules({ ...bookingRules, min_notice_hours: Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 ora</SelectItem>
                  <SelectItem value="2">2 ore</SelectItem>
                  <SelectItem value="4">4 ore</SelectItem>
                  <SelectItem value="12">12 ore</SelectItem>
                  <SelectItem value="24">24 ore</SelectItem>
                  <SelectItem value="48">48 ore</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prenotabile fino a</Label>
              <Select
                value={String(bookingRules.max_advance_days)}
                onValueChange={(v) =>
                  setBookingRules({ ...bookingRules, max_advance_days: Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 giorni</SelectItem>
                  <SelectItem value="14">14 giorni</SelectItem>
                  <SelectItem value="30">30 giorni</SelectItem>
                  <SelectItem value="60">60 giorni</SelectItem>
                  <SelectItem value="90">90 giorni</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Excluded Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Ferie / Giorni Esclusi
          </CardTitle>
          <CardDescription>
            Aggiungi date specifiche in cui non sei disponibile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {excludedDates
              .sort((a, b) => a.getTime() - b.getTime())
              .map((date, i) => (
                <Badge key={i} variant="secondary" className="gap-1 py-1.5 px-3">
                  {format(date, "d MMM yyyy", { locale: it })}
                  <button onClick={() => removeExcludedDate(i)} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            {excludedDates.length === 0 && (
              <p className="text-sm text-muted-foreground">Nessuna data esclusa</p>
            )}
          </div>

          <Popover open={excludePickerOpen} onOpenChange={setExcludePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi data
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                onSelect={addExcludedDate}
                disabled={(date) => date < new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>
    </div>
  );
}
