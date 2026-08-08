import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  Globe, 
  FileText, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { useKnowledge, KnowledgeSource } from "@/hooks/useKnowledge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export function KnowledgeUpload() {
  const { 
    sources, 
    isLoading, 
    isUploading, 
    isCrawling, 
    uploadPDF, 
    crawlWebsite, 
    deleteSource 
  } = useKnowledge();
  
  const [websiteUrl, setWebsiteUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pdfSources = sources.filter(s => s.source_type === "pdf");
  const websiteSource = sources.find(s => s.source_type === "website");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        alert("Per favore seleziona un file PDF");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        alert("Il file deve essere inferiore a 20MB");
        return;
      }
      await uploadPDF(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCrawl = async () => {
    if (!websiteUrl.trim()) return;
    await crawlWebsite(websiteUrl);
  };

  const getStatusBadge = (source: KnowledgeSource) => {
    switch (source.status) {
      case "completed":
        return <Badge variant="outline" className="text-success border-success"><CheckCircle className="w-3 h-3 mr-1" />Completato</Badge>;
      case "processing":
        return <Badge variant="outline" className="text-warning border-warning"><Loader2 className="w-3 h-3 mr-1 animate-spin" />In elaborazione</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-muted-foreground"><Clock className="w-3 h-3 mr-1" />In attesa</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Errore</Badge>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PDF Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Documenti PDF
          </CardTitle>
          <CardDescription>
            Carica fino a 5 PDF (max 20MB ciascuno) con informazioni sulla tua attività
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Area */}
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
              pdfSources.length >= 5 
                ? "border-muted bg-muted/20 cursor-not-allowed" 
                : "border-border hover:border-primary/50 hover:bg-primary/5"
            )}
            onClick={() => pdfSources.length < 5 && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileSelect}
              disabled={pdfSources.length >= 5 || isUploading}
            />
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Caricamento in corso...</p>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {pdfSources.length >= 5 
                    ? "Limite raggiunto (5 PDF)" 
                    : "Clicca o trascina un PDF qui"
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {pdfSources.length}/5 PDF caricati
                </p>
              </>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>PDF utilizzati</span>
              <span>{pdfSources.length}/5</span>
            </div>
            <Progress value={(pdfSources.length / 5) * 100} className="h-2" />
          </div>

          {/* PDF List */}
          {pdfSources.length > 0 && (
            <div className="space-y-2">
              {pdfSources.map((pdf) => (
                <div
                  key={pdf.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{pdf.source_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {pdf.page_count ? `${pdf.page_count} pagine • ` : ""}
                        {format(new Date(pdf.created_at), "d MMM yyyy", { locale: it })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(pdf)}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSource(pdf.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pdfSources.some(p => p.status === "failed") && (
            <div className="text-xs text-destructive">
              Alcuni PDF non sono stati elaborati correttamente. Prova a ricaricarli.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Website Crawl Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Sito Web
          </CardTitle>
          <CardDescription>
            Inserisci l'URL del tuo sito e lo analizzeremo automaticamente (fino a 50 pagine)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://www.tuosito.it"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              disabled={isCrawling}
            />
            <Button 
              onClick={handleCrawl} 
              disabled={!websiteUrl.trim() || isCrawling}
            >
              {isCrawling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analisi...
                </>
              ) : websiteSource ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Aggiorna
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 mr-2" />
                  Analizza
                </>
              )}
            </Button>
          </div>

          {websiteSource && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <span className="font-medium">{websiteSource.source_name}</span>
                </div>
                {getStatusBadge(websiteSource)}
              </div>
              
              {websiteSource.source_url && (
                <a 
                  href={websiteSource.source_url.startsWith("http") ? websiteSource.source_url : `https://${websiteSource.source_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {websiteSource.source_url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {websiteSource.status === "completed" && websiteSource.crawled_pages && (
                <p className="text-sm text-muted-foreground">
                  ✓ {websiteSource.crawled_pages} pagine analizzate
                </p>
              )}

              {websiteSource.status === "failed" && websiteSource.error_message && (
                <p className="text-sm text-destructive">
                  {websiteSource.error_message}
                </p>
              )}

              {websiteSource.status === "processing" && (
                <p className="text-sm text-muted-foreground animate-pulse">
                  Analisi in corso... questo può richiedere qualche minuto
                </p>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteSource(websiteSource.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Rimuovi sito
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
