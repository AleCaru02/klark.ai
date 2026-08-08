import { useState, useRef } from "react";
import { Lead, LeadStatus, useLeads } from "@/hooks/useLeads";
import { LeadCard } from "./LeadCard";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, Users } from "lucide-react";

interface LeadKanbanProps {
  leads: Lead[];
  isLoading: boolean;
  onLeadClick: (lead: Lead) => void;
  onStatusChange: (leadId: string, newStatus: LeadStatus, oldStatus: LeadStatus) => void;
}

const COLUMNS: { status: LeadStatus; label: string; color: string }[] = [
  { status: "TO_CALL", label: "Da Chiamare", color: "bg-blue-500" },
  { status: "IN_CONVO", label: "In Conversazione", color: "bg-yellow-500" },
  { status: "NO_ANSWER", label: "Non Risponde", color: "bg-orange-500" },
  { status: "APPOINTMENT_SET", label: "Appuntamento", color: "bg-green-500" },
  { status: "CLIENT", label: "Cliente", color: "bg-emerald-500" },
  { status: "LOST", label: "Perso", color: "bg-red-500" },
  { status: "DO_NOT_CONTACT", label: "Non Contattare", color: "bg-gray-500" },
];

export function LeadKanban({ leads, isLoading, onLeadClick, onStatusChange }: LeadKanbanProps) {
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: LeadStatus) => {
    e.preventDefault();
    if (draggedLead && draggedLead.status !== newStatus) {
      onStatusChange(draggedLead.id, newStatus, draggedLead.status);
    }
    setDraggedLead(null);
    setDragOverColumn(null);
  };

  const getLeadsByStatus = (status: LeadStatus) => {
    return leads.filter((lead) => lead.status === status);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {COLUMNS.map((column) => {
          const columnLeads = getLeadsByStatus(column.status);
          const isOver = dragOverColumn === column.status;

          return (
            <div
              key={column.status}
              className={`w-72 flex-shrink-0 rounded-lg border bg-card transition-colors ${
                isOver ? "ring-2 ring-primary bg-primary/5" : ""
              }`}
              onDragOver={(e) => handleDragOver(e, column.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.status)}
            >
              {/* Column Header */}
              <div className="p-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${column.color}`} />
                  <h3 className="font-medium text-sm">{column.label}</h3>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span className="text-xs">{columnLeads.length}</span>
                </div>
              </div>

              {/* Column Content */}
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="p-2 space-y-2">
                  {columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead)}
                      onDragEnd={handleDragEnd}
                    >
                      <LeadCard
                        lead={lead}
                        onClick={() => onLeadClick(lead)}
                        isDragging={draggedLead?.id === lead.id}
                      />
                    </div>
                  ))}
                  {columnLeads.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nessun lead
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
