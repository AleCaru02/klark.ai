import { useState, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateContact: (data: {
    name: string;
    phone?: string;
    email?: string;
    source?: "facebook_leadads" | "contact_form" | "manual" | "import";
  }) => Promise<void>;
  isPending: boolean;
}

interface CsvRow {
  name: string;
  phone?: string;
  email?: string;
}

function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return { rows: [], errors: ["Il file deve avere almeno un'intestazione e una riga dati."] };

  const header = lines[0].toLowerCase().split(/[,;\t]/).map((h) => h.trim().replace(/"/g, ""));
  const nameIdx = header.findIndex((h) => ["nome", "name", "full_name", "nome completo"].includes(h));
  const phoneIdx = header.findIndex((h) => ["telefono", "phone", "tel", "phone_e164", "cellulare"].includes(h));
  const emailIdx = header.findIndex((h) => ["email", "e-mail", "mail"].includes(h));

  if (nameIdx === -1) return { rows: [], errors: ["Colonna 'Nome' non trovata. Usa: nome, name, full_name."] };

  const rows: CsvRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const name = cols[nameIdx]?.trim();
    if (!name) {
      errors.push(`Riga ${i + 1}: nome vuoto, saltata.`);
      continue;
    }
    rows.push({
      name,
      phone: phoneIdx >= 0 ? cols[phoneIdx]?.trim() || undefined : undefined,
      email: emailIdx >= 0 ? cols[emailIdx]?.trim() || undefined : undefined,
    });
  }

  return { rows, errors };
}

export function CreateContactDialog({
  open,
  onOpenChange,
  onCreateContact,
  isPending,
}: CreateContactDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<"manual" | "import">("manual");

  // CSV state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvDone, setCsvDone] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onCreateContact({
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      source,
    });

    setName("");
    setPhone("");
    setEmail("");
    setSource("manual");
    onOpenChange(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, errors } = parseCsv(text);
      setCsvRows(rows);
      setCsvErrors(errors);
      setCsvDone(0);
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    if (csvRows.length === 0) return;
    setCsvImporting(true);
    let imported = 0;

    for (const row of csvRows) {
      try {
        await onCreateContact({
          name: row.name,
          phone: row.phone,
          email: row.email,
          source: "import",
        });
        imported++;
        setCsvDone(imported);
      } catch {
        // continue on error
      }
    }

    setCsvImporting(false);
    toast({ title: `${imported} contatti importati su ${csvRows.length}` });
    setCsvRows([]);
    setCsvErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  };

  const resetCsv = () => {
    setCsvRows([]);
    setCsvErrors([]);
    setCsvDone(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetCsv(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuovo Contatto</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="manual">
          <TabsList className="w-full">
            <TabsTrigger value="manual" className="flex-1">Manuale</TabsTrigger>
            <TabsTrigger value="csv" className="flex-1">Import CSV</TabsTrigger>
          </TabsList>

          {/* Manual Tab */}
          <TabsContent value="manual">
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mario Rossi" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 333 1234567" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mario@esempio.it" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Sorgente</Label>
                <Select value={source} onValueChange={(v) => setSource(v as "manual" | "import")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Inserimento Manuale</SelectItem>
                    <SelectItem value="import">Importato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
                <Button type="submit" disabled={!name.trim() || isPending}>
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Crea Contatto
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* CSV Tab */}
          <TabsContent value="csv">
            <div className="space-y-4 pt-2">
              <div className="border-2 border-dashed rounded-xl p-6 text-center">
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">
                  Carica un file CSV con colonne: <strong>nome</strong>, telefono, email
                </p>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  className="max-w-xs mx-auto"
                />
              </div>

              {csvErrors.length > 0 && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Avvisi
                  </div>
                  {csvErrors.map((err, i) => (
                    <p key={i} className="text-xs">{err}</p>
                  ))}
                </div>
              )}

              {csvRows.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {csvRows.length} contatti trovati
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {csvRows.slice(0, 5).map((row, i) => (
                      <div key={i} className="text-xs flex gap-3 text-muted-foreground">
                        <span className="font-medium text-foreground">{row.name}</span>
                        {row.phone && <span>{row.phone}</span>}
                        {row.email && <span>{row.email}</span>}
                      </div>
                    ))}
                    {csvRows.length > 5 && (
                      <p className="text-xs text-muted-foreground">...e altri {csvRows.length - 5}</p>
                    )}
                  </div>

                  {csvImporting && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importazione {csvDone}/{csvRows.length}...
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
                <Button
                  onClick={handleCsvImport}
                  disabled={csvRows.length === 0 || csvImporting}
                >
                  {csvImporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Importa {csvRows.length} contatti
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
