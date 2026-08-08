import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { fetchIntegrationStatus } from "@/hooks/useIntegrationStatus";

export type WhatsAppConnectionState = "disconnected" | "connected" | "expired" | "error";

export interface WhatsAppIntegrationView {
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  token_expires_at: string | null;
  updated_at: string | null;
}

export interface WhatsAppTemplateView {
  id: string;
  template_name: string;
  template_type: string;
  body_text: string;
  status: string;
  meta_template_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

type TemplateType = "confirmation" | "reminder" | "canceled" | "rescheduled" | "missed_call";

function safeMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && /not connected|expired|unauthorized/i.test(error.message)) {
    return error.message;
  }
  return fallback;
}

function isTrustedMetaAuthUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "www.facebook.com" || url.hostname === "facebook.com");
  } catch {
    return false;
  }
}

export function useWhatsAppIntegration() {
  const { session, membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const [integration, setIntegration] = useState<WhatsAppIntegrationView | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplateView[]>([]);
  const [connectionState, setConnectionState] = useState<WhatsAppConnectionState>("disconnected");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requireSession = () => {
    if (!session?.access_token) throw new Error("Sessione non valida. Accedi nuovamente.");
    return session.access_token;
  };

  const fetchIntegration = useCallback(async () => {
    if (!tenantId) {
      setIntegration(null);
      setConnectionState("disconnected");
      return;
    }

    const status = await fetchIntegrationStatus();
    if (!status.whatsapp.connected) {
      setIntegration(null);
      setConnectionState("disconnected");
      return;
    }

    const requiredIdsPresent = Boolean(
      status.whatsapp.waba_id && status.whatsapp.phone_number_id,
    );
    if (!requiredIdsPresent) {
      setIntegration(null);
      setConnectionState("error");
      throw new Error("Configurazione WhatsApp incompleta.");
    }

    setIntegration({
      waba_id: status.whatsapp.waba_id as string,
      phone_number_id: status.whatsapp.phone_number_id as string,
      display_phone_number: status.whatsapp.display_phone_number ?? null,
      verified_name: status.whatsapp.verified_name ?? null,
      token_expires_at: status.whatsapp.token_expires_at ?? null,
      updated_at: status.whatsapp.updated_at ?? null,
    });
    setConnectionState(status.whatsapp.expired ? "expired" : "connected");
  }, [tenantId]);

  const fetchTemplates = useCallback(async () => {
    if (!tenantId) {
      setTemplates([]);
      return;
    }

    const { data, error: templatesError } = await supabase
      .from("whatsapp_templates")
      .select("id,template_name,template_type,body_text,status,meta_template_id,rejection_reason,created_at,updated_at")
      .eq("tenant_id", tenantId)
      .order("template_type");
    if (templatesError) throw templatesError;
    setTemplates((data ?? []) as WhatsAppTemplateView[]);
  }, [tenantId]);

  const refetch = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([fetchIntegration(), fetchTemplates()]);
    } catch (loadError) {
      console.error("Unable to load WhatsApp integration state");
      setConnectionState("error");
      setError(safeMessage(loadError, "Stato WhatsApp non disponibile."));
    }
  }, [fetchIntegration, fetchTemplates]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      await refetch();
      if (active) setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [refetch]);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const accessToken = requireSession();
      const { data, error: invokeError } = await supabase.functions.invoke("whatsapp-auth-start", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {},
      });
      if (invokeError) throw invokeError;
      if (!isTrustedMetaAuthUrl(data?.auth_url)) throw new Error("Risposta OAuth non valida.");
      window.location.assign(data.auth_url);
    } catch (connectError) {
      console.error("Unable to start WhatsApp OAuth");
      const message = safeMessage(connectError, "Impossibile avviare il collegamento WhatsApp.");
      setError(message);
      toast.error(message);
      setConnecting(false);
    }
  };

  const disconnect = async (): Promise<boolean> => {
    setDisconnecting(true);
    setError(null);
    try {
      const accessToken = requireSession();
      const { data, error: invokeError } = await supabase.functions.invoke("whatsapp-disconnect", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {},
      });
      if (invokeError || data?.success !== true) throw invokeError ?? new Error("Disconnection failed");

      setIntegration(null);
      setTemplates([]);
      setConnectionState("disconnected");
      toast.success("Connessione locale rimossa");
      if (data.provider_token_revocation_required === true) {
        toast.info("Verifica anche le autorizzazioni dell'app nel Business Manager Meta.");
      }
      return true;
    } catch (disconnectError) {
      console.error("Unable to disconnect WhatsApp");
      const message = safeMessage(disconnectError, "Impossibile disconnettere WhatsApp.");
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setDisconnecting(false);
    }
  };

  const createTemplate = async (templateType: TemplateType, bodyText: string): Promise<boolean> => {
    const normalizedBody = bodyText.trim();
    if (connectionState !== "connected") {
      toast.error("La connessione WhatsApp non è valida.");
      return false;
    }
    if (normalizedBody.length < 10 || normalizedBody.length > 1024) {
      toast.error("Il template deve contenere tra 10 e 1024 caratteri.");
      return false;
    }

    try {
      const accessToken = requireSession();
      const { data, error: invokeError } = await supabase.functions.invoke("whatsapp-create-template", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { template_type: templateType, body_text: normalizedBody },
      });
      if (invokeError || data?.success !== true) throw invokeError ?? new Error("Template creation failed");

      toast.success("Template inviato a Meta. Lo stato resterà in attesa finché Meta non risponde.");
      await fetchTemplates();
      return true;
    } catch (templateError) {
      console.error("Unable to create WhatsApp template");
      toast.error(safeMessage(templateError, "Meta non ha accettato il template."));
      await fetchTemplates().catch(() => undefined);
      return false;
    }
  };

  return {
    integration,
    templates,
    loading,
    connecting,
    disconnecting,
    connectionState,
    isConnected: connectionState === "connected",
    error,
    connect,
    disconnect,
    createTemplate,
    refetch,
  };
}
