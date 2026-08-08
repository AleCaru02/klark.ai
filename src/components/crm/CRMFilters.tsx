import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadStatus } from "@/hooks/useLeads";

interface CRMFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: LeadStatus | "all";
  onStatusFilterChange: (value: LeadStatus | "all") => void;
  sourceFilter: string;
  onSourceFilterChange: (value: string) => void;
}

const STATUS_OPTIONS: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "Tutti gli stati" },
  { value: "NEW", label: "Nuovo" },
  { value: "TO_CALL", label: "Da Chiamare" },
  { value: "IN_CONVO", label: "In Conversazione" },
  { value: "NO_ANSWER", label: "Non Risponde" },
  { value: "APPOINTMENT_SET", label: "Appuntamento" },
  { value: "CLIENT", label: "Cliente" },
  { value: "LOST", label: "Perso" },
  { value: "DO_NOT_CONTACT", label: "Non Contattare" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "Tutte le fonti" },
  { value: "facebook_ads", label: "Facebook Ads" },
  { value: "website_form", label: "Form Sito" },
  { value: "referral", label: "Referral" },
  { value: "manual", label: "Manuale" },
  { value: "import", label: "Import" },
];

export function CRMFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sourceFilter,
  onSourceFilterChange,
}: CRMFiltersProps) {
  const hasActiveFilters = search || statusFilter !== "all" || sourceFilter !== "all";

  const clearFilters = () => {
    onSearchChange("");
    onStatusFilterChange("all");
    onSourceFilterChange("all");
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cerca nome, telefono, email..."
          className="pl-9"
        />
      </div>

      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Stato" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Source Filter */}
      <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Fonte" />
        </SelectTrigger>
        <SelectContent>
          {SOURCE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Pulisci
        </Button>
      )}
    </div>
  );
}
