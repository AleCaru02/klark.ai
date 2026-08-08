import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCallQueue, CallQueueItem } from "@/hooks/useCallQueue";
import { Phone, PhoneOff, RefreshCw, Trash2, Clock, CheckCircle, XCircle, Loader2, Play, User } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CallQueueTabProps {
  onViewContact: (contactId: string) => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pending: { label: "In attesa", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  calling: { label: "In chiamata", variant: "default", icon: <Phone className="h-3 w-3" /> },
  no_answer: { label: "Nessuna risposta", variant: "outline", icon: <PhoneOff className="h-3 w-3" /> },
  completed: { label: "Completato", variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
  booked: { label: "Prenotato", variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
  failed: { label: "Fallito", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
};

function QueueItemRow({ 
  item, 
  onTriggerCall, 
  onRemove,
  onViewContact,
}: { 
  item: CallQueueItem; 
  onTriggerCall: (item: CallQueueItem) => void;
  onRemove: (id: string) => void;
  onViewContact: (contactId: string) => void;
}) {
  const status = statusConfig[item.status] || statusConfig.pending;
  const canCall = item.status === "pending" || item.status === "no_answer";

  return (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onViewContact(item.contact_id)}
    >
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p>{item.contact?.name || "N/A"}</p>
            <p className="text-xs text-muted-foreground">{item.contact?.phone_e164}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={status.variant} className="gap-1">
          {status.icon}
          {status.label}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <span className={item.attempt_count > 0 ? "text-orange-600 font-medium" : ""}>
          {item.attempt_count} / {item.max_attempts}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {item.next_attempt_at 
          ? formatDistanceToNow(new Date(item.next_attempt_at), { addSuffix: true, locale: it })
          : "-"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
        {item.notes || item.outcome || "-"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {format(new Date(item.created_at), "dd/MM HH:mm", { locale: it })}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          {canCall && (
            <Button size="sm" variant="outline" onClick={() => onTriggerCall(item)}>
              <Play className="h-3 w-3 mr-1" /> Chiama
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rimuovere dalla coda?</AlertDialogTitle>
                <AlertDialogDescription>
                  Il contatto {item.contact?.name} verrà rimosso dalla coda chiamate.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={() => onRemove(item.id)}>
                  Rimuovi
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

function QueueTable({ 
  items, 
  onTriggerCall, 
  onRemove,
  onViewContact,
}: { 
  items: CallQueueItem[]; 
  onTriggerCall: (item: CallQueueItem) => void;
  onRemove: (id: string) => void;
  onViewContact: (contactId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nessun elemento in questa sezione</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contatto</TableHead>
          <TableHead>Stato</TableHead>
          <TableHead className="text-center">Tentativi</TableHead>
          <TableHead>Prossimo tentativo</TableHead>
          <TableHead>Note/Esito</TableHead>
          <TableHead>Creato</TableHead>
          <TableHead className="text-right">Azioni</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <QueueItemRow 
            key={item.id} 
            item={item} 
            onTriggerCall={onTriggerCall}
            onRemove={onRemove}
            onViewContact={onViewContact}
          />
        ))}
      </TableBody>
    </Table>
  );
}

export function CallQueueTab({ onViewContact }: CallQueueTabProps) {
  const { queueItems, pendingItems, completedItems, failedItems, isLoading, triggerCall, removeFromQueue } = useCallQueue();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTriggerCall = (item: CallQueueItem) => {
    triggerCall.mutate({ contactId: item.contact_id, queueId: item.id });
  };

  const handleRemove = (id: string) => {
    removeFromQueue.mutate(id);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-call-queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({}),
      });
    } catch (e) {
      console.error("Error triggering queue process:", e);
    }
    setIsRefreshing(false);
  };

  // Count no_answer items
  const noAnswerItems = queueItems.filter((item) => item.status === "no_answer");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 mr-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Totale in coda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{queueItems.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In attesa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingItems.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Non hanno risposto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{noAnswerItems.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completati</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{completedItems.length}</div>
            </CardContent>
          </Card>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Processa
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco Chiamate</CardTitle>
          <CardDescription>
            I lead vengono chiamati automaticamente durante gli orari di disponibilità
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="pending">
                  In attesa ({pendingItems.length})
                </TabsTrigger>
                <TabsTrigger value="no_answer">
                  Non risposto ({noAnswerItems.length})
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completati ({completedItems.length})
                </TabsTrigger>
                <TabsTrigger value="failed">
                  Falliti ({failedItems.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="pending" className="mt-4">
                <QueueTable 
                  items={pendingItems.filter(i => i.status === "pending")} 
                  onTriggerCall={handleTriggerCall} 
                  onRemove={handleRemove}
                  onViewContact={onViewContact}
                />
              </TabsContent>
              <TabsContent value="no_answer" className="mt-4">
                <QueueTable 
                  items={noAnswerItems} 
                  onTriggerCall={handleTriggerCall} 
                  onRemove={handleRemove}
                  onViewContact={onViewContact}
                />
              </TabsContent>
              <TabsContent value="completed" className="mt-4">
                <QueueTable 
                  items={completedItems} 
                  onTriggerCall={handleTriggerCall} 
                  onRemove={handleRemove}
                  onViewContact={onViewContact}
                />
              </TabsContent>
              <TabsContent value="failed" className="mt-4">
                <QueueTable 
                  items={failedItems} 
                  onTriggerCall={handleTriggerCall} 
                  onRemove={handleRemove}
                  onViewContact={onViewContact}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
