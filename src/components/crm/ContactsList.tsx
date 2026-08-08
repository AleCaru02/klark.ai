import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { PhoneOff, Download, FileSpreadsheet, FileText as FileTextIcon } from "lucide-react";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreVertical, Phone, Mail, User, Trash2, Eye, Plus } from "lucide-react";
import { ContactWithDetails, Stage } from "@/hooks/useCRM";

interface ContactsListProps {
  contacts: ContactWithDetails[];
  stages: Stage[];
  onViewContact: (contact: ContactWithDetails) => void;
  onDeleteContact: (contactId: string) => void;
  onCreateContact: () => void;
  contactQueueMap?: Map<string, { attempt_count: number; max_attempts: number; status: string; next_attempt_at: string | null }>;
}

const sourceLabels: Record<string, string> = {
  facebook_leadads: "Facebook Lead Ads",
  contact_form: "Form Contatto",
  manual: "Manuale",
  import: "Importato",
};

const sourceBadgeColors: Record<string, string> = {
  facebook_leadads: "bg-blue-500/10 text-blue-600 border-blue-200",
  contact_form: "bg-green-500/10 text-green-600 border-green-200",
  manual: "bg-gray-500/10 text-gray-600 border-gray-200",
  import: "bg-purple-500/10 text-purple-600 border-purple-200",
};

export function ContactsList({
  contacts,
  stages,
  onViewContact,
  onDeleteContact,
  onCreateContact,
  contactQueueMap,
}: ContactsListProps) {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      contact.name.toLowerCase().includes(search.toLowerCase()) ||
      contact.email?.toLowerCase().includes(search.toLowerCase()) ||
      contact.phone_e164?.includes(search);

    const matchesSource =
      !sourceFilter || contact.contact_sources?.[0]?.source === sourceFilter;

    return matchesSearch && matchesSource;
  });

  const getStageForContact = (contact: ContactWithDetails) => {
    const stageId = contact.contact_stages?.[0]?.stage_id;
    return stages.find((s) => s.id === stageId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, email o telefono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {sourceFilter ? sourceLabels[sourceFilter] : "Tutte le sorgenti"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSourceFilter(null)}>
              Tutte le sorgenti
            </DropdownMenuItem>
            {Object.entries(sourceLabels).map(([key, label]) => (
              <DropdownMenuItem key={key} onClick={() => setSourceFilter(key)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" title="Esporta">
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              const exportData = filteredContacts.map((c) => ({
                name: c.name,
                phone_e164: c.phone_e164 || "",
                email: c.email || "",
                stage: getStageForContact(c)?.name || "",
                source: c.contact_sources?.[0]?.source ? sourceLabels[c.contact_sources[0].source] || c.contact_sources[0].source : "",
                created_at: format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: it }),
              }));
              exportToCSV(exportData, `contatti_${format(new Date(), "yyyyMMdd")}`);
            }}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Esporta CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const exportData = filteredContacts.map((c) => ({
                name: c.name,
                phone_e164: c.phone_e164 || "",
                email: c.email || "",
                stage: getStageForContact(c)?.name || "",
                source: c.contact_sources?.[0]?.source ? sourceLabels[c.contact_sources[0].source] || c.contact_sources[0].source : "",
                created_at: format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: it }),
              }));
              exportToPDF(exportData, `contatti_${format(new Date(), "yyyyMMdd")}`, "Elenco Contatti");
            }}>
              <FileTextIcon className="h-4 w-4 mr-2" />
              Esporta PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={onCreateContact}>
          <Plus className="h-4 w-4 mr-2" />
          Nuovo Contatto
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contatto</TableHead>
              <TableHead>Telefono</TableHead>
              <TableHead>Sorgente</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Tentativi</TableHead>
              <TableHead>Creato</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nessun contatto trovato
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => {
                const source = contact.contact_sources?.[0]?.source;
                const stage = getStageForContact(contact);
                const queueInfo = contactQueueMap?.get(contact.id);

                return (
                  <TableRow
                    key={contact.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onViewContact(contact)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{contact.name}</p>
                          {contact.email && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.phone_e164 ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {contact.phone_e164}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {source ? (
                        <Badge
                          variant="outline"
                          className={sourceBadgeColors[source] || ""}
                        >
                          {sourceLabels[source]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {stage ? (
                        <Badge variant="secondary">{stage.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {queueInfo ? (
                        queueInfo.status === "completed" || queueInfo.status === "booked" ? (
                          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-200">
                            ✓ Completato
                          </Badge>
                        ) : queueInfo.attempt_count > 0 ? (
                          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                            <PhoneOff className="h-3 w-3 mr-1" />
                            {queueInfo.attempt_count}/{queueInfo.max_attempts}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                            In coda
                          </Badge>
                        )
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(contact.created_at), "d MMM yyyy", { locale: it })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onViewContact(contact)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Visualizza
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteContact(contact.id);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Elimina
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
