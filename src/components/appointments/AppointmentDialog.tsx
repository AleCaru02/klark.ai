import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { format, addHours, parseISO } from "date-fns";

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

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "reschedule";
  appointment?: Appointment | null;
  selectedDate?: Date;
  onSubmit: (data: {
    title: string;
    description?: string;
    location?: string;
    start_at: string;
    end_at: string;
    create_meet: boolean;
  }) => Promise<void>;
  isLoading: boolean;
}

export function AppointmentDialog({
  open,
  onOpenChange,
  mode,
  appointment,
  selectedDate,
  onSubmit,
  isLoading,
}: AppointmentDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [createMeet, setCreateMeet] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === "reschedule" && appointment) {
        setTitle(appointment.title || appointment.name || "");
        setDescription(appointment.description || "");
        setLocation(appointment.location || "");
        setStartDate(appointment.date);
        setStartTime(appointment.time);
        // Calculate end time from duration
        const [hours, minutes] = appointment.time.split(":").map(Number);
        const endMinutes = hours * 60 + minutes + appointment.duration;
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        setEndTime(`${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`);
        setCreateMeet(appointment.hasMeet);
      } else if (mode === "create") {
        const date = selectedDate || new Date();
        setTitle("");
        setDescription("");
        setLocation("");
        setStartDate(format(date, "yyyy-MM-dd"));
        setStartTime("09:00");
        setEndTime("10:00");
        setCreateMeet(false);
      }
    }
  }, [open, mode, appointment, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const start_at = `${startDate}T${startTime}:00+01:00`;
    const end_at = `${startDate}T${endTime}:00+01:00`;

    await onSubmit({
      title,
      description: description || undefined,
      location: location || undefined,
      start_at,
      end_at,
      create_meet: createMeet,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuovo Appuntamento" : "Sposta Appuntamento"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Titolo</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Es. Visita di controllo"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start-time">Ora inizio</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end-time">Ora fine</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="location">Luogo (opzionale)</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Es. Studio via Roma 1"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Note (opzionale)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Aggiungi note..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="create-meet">Crea link Google Meet</Label>
              <Switch
                id="create-meet"
                checked={createMeet}
                onCheckedChange={setCreateMeet}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "create" ? "Crea" : "Sposta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
