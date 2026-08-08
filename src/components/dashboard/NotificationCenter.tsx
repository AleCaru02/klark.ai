import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Phone, Calendar, MessageCircle, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Notification {
  id: string;
  type: "call" | "appointment" | "message" | "lead";
  title: string;
  description: string;
  time: string;
  read: boolean;
  icon: typeof Phone;
  color: string;
}

export function NotificationCenter() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (tenantId) fetchNotifications();
  }, [tenantId]);

  // Subscribe to realtime changes for new events
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_logs", filter: `tenant_id=eq.${tenantId}` },
        () => fetchNotifications()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments", filter: `tenant_id=eq.${tenantId}` },
        () => fetchNotifications()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contacts", filter: `tenant_id=eq.${tenantId}` },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const fetchNotifications = async () => {
    if (!tenantId) return;
    setLoading(true);

    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [callsRes, appointmentsRes, contactsRes, messagesRes] = await Promise.all([
        supabase
          .from("call_logs")
          .select("id, created_at, direction, connected_seconds, contacts(name, phone_e164)")
          .eq("tenant_id", tenantId)
          .gte("created_at", last24h)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("appointments")
          .select("id, created_at, start_at, status, contacts(name)")
          .eq("tenant_id", tenantId)
          .gte("created_at", last24h)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("contacts")
          .select("id, created_at, name, phone_e164")
          .eq("tenant_id", tenantId)
          .gte("created_at", last24h)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("message_logs")
          .select("id, created_at, status, template_name, contacts(name)")
          .eq("tenant_id", tenantId)
          .gte("created_at", last24h)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const items: Notification[] = [];

      // Map calls
      (callsRes.data || []).forEach((call) => {
        const contact = call.contacts as unknown as { name: string; phone_e164: string } | null;
        const missed = (call.connected_seconds || 0) === 0;
        items.push({
          id: `call-${call.id}`,
          type: "call",
          title: missed ? "Chiamata persa" : `Chiamata ${call.direction === "inbound" ? "ricevuta" : "effettuata"}`,
          description: contact?.name || contact?.phone_e164 || "Numero sconosciuto",
          time: getRelativeTime(call.created_at),
          read: !missed,
          icon: Phone,
          color: missed ? "text-destructive" : "text-primary",
        });
      });

      // Map appointments
      (appointmentsRes.data || []).forEach((apt) => {
        const contact = apt.contacts as unknown as { name: string } | null;
        const statusLabel =
          apt.status === "confirmed" ? "confermato" :
          apt.status === "canceled" ? "cancellato" :
          apt.status === "rescheduled" ? "spostato" : "creato";
        items.push({
          id: `apt-${apt.id}`,
          type: "appointment",
          title: `Appuntamento ${statusLabel}`,
          description: contact?.name || "Cliente",
          time: getRelativeTime(apt.created_at),
          read: apt.status !== "canceled",
          icon: Calendar,
          color: apt.status === "canceled" ? "text-destructive" : "text-success",
        });
      });

      // Map new contacts/leads
      (contactsRes.data || []).forEach((c) => {
        items.push({
          id: `lead-${c.id}`,
          type: "lead",
          title: "Nuovo lead",
          description: c.name || c.phone_e164 || "Contatto",
          time: getRelativeTime(c.created_at),
          read: false,
          icon: Bell,
          color: "text-accent",
        });
      });

      // Map messages
      (messagesRes.data || []).forEach((msg) => {
        const contact = msg.contacts as unknown as { name: string } | null;
        items.push({
          id: `msg-${msg.id}`,
          type: "message",
          title: msg.status === "failed" ? "Messaggio fallito" : "WhatsApp inviato",
          description: contact?.name || msg.template_name || "Messaggio",
          time: getRelativeTime(msg.created_at),
          read: msg.status !== "failed",
          icon: MessageCircle,
          color: msg.status === "failed" ? "text-destructive" : "text-success",
        });
      });

      // Sort by time (most recent first) and take top 15
      items.sort((a, b) => {
        // Simple sort - items are already sorted from DB
        return 0;
      });

      setNotifications(items.slice(0, 15));
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notifiche</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={markAllRead}
            >
              <Check className="w-3 h-3 mr-1" />
              Segna tutte lette
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nessuna notifica</p>
              <p className="text-xs mt-1">Le attività delle ultime 24h appariranno qui</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-0",
                  !n.read && "bg-primary/5"
                )}
              >
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", n.read ? "bg-muted" : "bg-primary/10")}>
                  <n.icon className={cn("w-4 h-4", n.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm font-medium truncate", !n.read && "font-semibold")}>
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "adesso";
  if (diffMins < 60) return `${diffMins} min fa`;
  if (diffHours < 24) return `${diffHours}h fa`;
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}
