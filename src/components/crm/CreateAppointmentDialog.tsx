import { useState, useEffect } from "react";
import { format, addMinutes } from "date-fns";
import { it } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Clock, Loader2, MapPin, Video, Phone } from "lucide-react";
import { useCreateAppointment, MeetingType, MeetingProvider } from "@/hooks/useCreateAppointment";

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
}

const DURATION_OPTIONS = [
  { value: "15", label: "15 minuti" },
  { value: "30", label: "30 minuti" },
  { value: "45", label: "45 minuti" },
  { value: "60", label: "1 ora" },
  { value: "90", label: "1 ora 30 min" },
  { value: "120", label: "2 ore" },
];

const APPOINTMENT_TYPE_OPTIONS = [
  { value: "google_meet", label: "Google Meet", icon: Video, meetingType: "online" as MeetingType },
  { value: "zoom", label: "Zoom", icon: Video, meetingType: "online" as MeetingType },
  { value: "in_person", label: "Sopralluogo", icon: MapPin, meetingType: "in_person" as MeetingType },
  { value: "call", label: "Chiamata", icon: Phone, meetingType: "online" as MeetingType },
  { value: "other", label: "Altro", icon: Calendar, meetingType: "online" as MeetingType },
];

export function CreateAppointmentDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
}: CreateAppointmentDialogProps) {
  const { createAppointment } = useCreateAppointment();
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const [formData, setFormData] = useState({
    title: `Appuntamento con ${contactName}`,
    date: format(tomorrow, "yyyy-MM-dd"),
    time: "10:00",
    duration: "30",
    description: "",
    appointmentType: "google_meet",
    location: "",
  });

  // Reset title when contactName changes
  useEffect(() => {
    if (open) {
      setFormData(prev => ({ ...prev, title: `Appuntamento con ${contactName}` }));
    }
  }, [contactName, open]);

  const selectedType = APPOINTMENT_TYPE_OPTIONS.find(t => t.value === formData.appointmentType);
  const isInPerson = formData.appointmentType === "in_person";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const [hours, minutes] = formData.time.split(":").map(Number);
    const startAt = new Date(formData.date);
    startAt.setHours(hours, minutes, 0, 0);

    const provider: MeetingProvider = 
      formData.appointmentType === "google_meet" ? "google_meet" :
      formData.appointmentType === "zoom" ? "zoom" :
      formData.appointmentType === "call" ? "call" :
      formData.appointmentType === "other" ? "other" : null;

    await createAppointment.mutateAsync({
      contactId,
      title: formData.title,
      startAt,
      durationMinutes: parseInt(formData.duration),
      description: formData.description || undefined,
      meetingType: selectedType?.meetingType || "online",
      meetingProvider: provider,
      location: isInPerson ? formData.location : undefined,
    });

    onOpenChange(false);
    
    setFormData({
      title: `Appuntamento con ${contactName}`,
      date: format(tomorrow, "yyyy-MM-dd"),
      time: "10:00",
      duration: "30",
      description: "",
      appointmentType: "google_meet",
      location: "",
    });
  };

  const startAt = (() => {
    const [hours, minutes] = formData.time.split(":").map(Number);
    const date = new Date(formData.date);
    date.setHours(hours, minutes, 0, 0);
    return date;
  })();

  const endAt = addMinutes(startAt, parseInt(formData.duration));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Fissa Appuntamento
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titolo</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
              placeholder="Titolo appuntamento"
              required
            />
          </div>

          {/* Tipo appuntamento */}
          <div className="space-y-2">
            <Label>Tipo appuntamento</Label>
            <Select
              value={formData.appointmentType}
              onValueChange={(value) => setFormData(f => ({ ...f, appointmentType: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <opt.icon className="h-4 w-4" />
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Ora</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData(f => ({ ...f, time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Durata</Label>
            <Select
              value={formData.duration}
              onValueChange={(value) => setFormData(f => ({ ...f, duration: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location (only for sopralluogo) */}
          {isInPerson && (
            <div className="space-y-2">
              <Label htmlFor="location">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Indirizzo sopralluogo
                </span>
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(f => ({ ...f, location: e.target.value }))}
                placeholder="Via Roma 1, Milano"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Note (opzionale)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
              placeholder="Note aggiuntive per l'appuntamento..."
              className="min-h-[80px]"
            />
          </div>

          {/* Preview */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                {format(startAt, "EEEE d MMMM yyyy", { locale: it })} dalle{" "}
                {format(startAt, "HH:mm")} alle {format(endAt, "HH:mm")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              {selectedType && <selectedType.icon className="h-4 w-4" />}
              <span>{selectedType?.label || "Online"}</span>
              {isInPerson && formData.location && (
                <span className="text-xs">— {formData.location}</span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={createAppointment.isPending}>
              {createAppointment.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creazione...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Crea Appuntamento
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
