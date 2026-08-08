import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface KnowledgeSource {
  id: string;
  tenant_id: string;
  source_type: "pdf" | "website";
  source_name: string;
  source_url?: string;
  storage_path?: string;
  content_text?: string;
  content_summary?: string;
  page_count?: number;
  crawled_pages?: number;
  status: "pending" | "processing" | "completed" | "failed";
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export function useKnowledge() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const { toast } = useToast();
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;

  const fetchSources = useCallback(async () => {
    if (!tenantId) return;

    try {
      const { data, error } = await supabase
        .from("tenant_knowledge")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSources((data as KnowledgeSource[]) || []);
    } catch (error) {
      console.error("Error fetching knowledge sources:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Poll for status updates
  useEffect(() => {
    const processingItems = sources.filter(s => s.status === "processing" || s.status === "pending");
    
    if (processingItems.length === 0) return;

    const interval = setInterval(() => {
      fetchSources();
    }, 5000);

    return () => clearInterval(interval);
  }, [sources, fetchSources]);

  const uploadPDF = async (file: File) => {
    if (!tenantId) {
      toast({ title: "Errore", description: "Tenant non trovato", variant: "destructive" });
      return;
    }

    // Check PDF limit (max 5)
    const pdfCount = sources.filter(s => s.source_type === "pdf").length;
    if (pdfCount >= 5) {
      toast({ 
        title: "Limite raggiunto", 
        description: "Puoi caricare massimo 5 PDF. Elimina un file esistente prima di caricarne uno nuovo.",
        variant: "destructive" 
      });
      return;
    }

    setIsUploading(true);

    try {
      // Create knowledge record first
      const { data: knowledgeRecord, error: insertError } = await supabase
        .from("tenant_knowledge")
        .insert({
          tenant_id: tenantId,
          source_type: "pdf",
          source_name: file.name,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload file to storage
      const storagePath = `${tenantId}/${knowledgeRecord.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("tenant-knowledge")
        .upload(storagePath, file, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        // Delete the knowledge record if upload failed
        await supabase.from("tenant_knowledge").delete().eq("id", knowledgeRecord.id);
        throw uploadError;
      }

      // Update the record with storage path
      await supabase
        .from("tenant_knowledge")
        .update({ storage_path: storagePath })
        .eq("id", knowledgeRecord.id);

      // Trigger PDF parsing
      const { error: parseError } = await supabase.functions.invoke("parse-pdf", {
        body: {
          tenant_id: tenantId,
          knowledge_id: knowledgeRecord.id,
          storage_path: storagePath,
        },
      });

      if (parseError) {
        console.error("Parse error:", parseError);
      }

      toast({ title: "PDF caricato", description: "Il file è in elaborazione..." });
      fetchSources();
    } catch (error) {
      console.error("Upload error:", error);
      toast({ 
        title: "Errore upload", 
        description: error instanceof Error ? error.message : "Errore durante il caricamento",
        variant: "destructive" 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const crawlWebsite = async (url: string) => {
    if (!tenantId) {
      toast({ title: "Errore", description: "Tenant non trovato", variant: "destructive" });
      return;
    }

    // Check if website already exists
    const existingWebsite = sources.find(s => s.source_type === "website");
    
    setIsCrawling(true);

    try {
      let knowledgeId: string;

      if (existingWebsite) {
        // Update existing website record
        knowledgeId = existingWebsite.id;
        await supabase
          .from("tenant_knowledge")
          .update({ 
            source_url: url, 
            source_name: new URL(url.startsWith("http") ? url : `https://${url}`).hostname,
            status: "pending",
            error_message: null,
            content_text: null,
            crawled_pages: null,
          })
          .eq("id", knowledgeId);
      } else {
        // Create new website record
        const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
        const { data: knowledgeRecord, error: insertError } = await supabase
          .from("tenant_knowledge")
          .insert({
            tenant_id: tenantId,
            source_type: "website",
            source_name: hostname,
            source_url: url,
            status: "pending",
          })
          .select()
          .single();

        if (insertError) throw insertError;
        knowledgeId = knowledgeRecord.id;
      }

      // Trigger crawl
      const { error: crawlError } = await supabase.functions.invoke("crawl-website", {
        body: {
          tenant_id: tenantId,
          knowledge_id: knowledgeId,
          url: url,
        },
      });

      if (crawlError) {
        console.error("Crawl error:", crawlError);
      }

      toast({ title: "Crawl avviato", description: "Il sito è in fase di analisi..." });
      fetchSources();
    } catch (error) {
      console.error("Crawl error:", error);
      toast({ 
        title: "Errore", 
        description: error instanceof Error ? error.message : "Errore durante il crawl",
        variant: "destructive" 
      });
    } finally {
      setIsCrawling(false);
    }
  };

  const deleteSource = async (id: string) => {
    try {
      const source = sources.find(s => s.id === id);
      
      // Delete from storage if it's a PDF
      if (source?.storage_path) {
        await supabase.storage
          .from("tenant-knowledge")
          .remove([source.storage_path]);
      }

      // Delete from database
      const { error } = await supabase
        .from("tenant_knowledge")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Eliminato", description: "Fonte di conoscenza rimossa" });
      fetchSources();
    } catch (error) {
      console.error("Delete error:", error);
      toast({ 
        title: "Errore", 
        description: "Impossibile eliminare la fonte",
        variant: "destructive" 
      });
    }
  };

  return {
    sources,
    isLoading,
    isUploading,
    isCrawling,
    uploadPDF,
    crawlWebsite,
    deleteSource,
    refetch: fetchSources,
  };
}
