import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Stato integrazioni per il tenant dell'utente autenticato.
 *
 * IMPORTANTE: nessun token/segreto viene mai restituito al browser.
 * I dati arrivano dalla RPC server-side `get_integration_status()`
 * (SECURITY DEFINER, search_path fissato, tenant derivato da auth.uid()).
 */

export interface GoogleIntegrationStatus {
  connected: boolean;
  calendar_id?: string | null;
  scope?: string | null;
  token_expires_at?: string | null;
  expired?: boolean;
  updated_at?: string | null;
}

export interface FacebookIntegrationStatus {
  connected: boolean;
  page_id?: string | null;
  pending_page_selection?: boolean;
  token_expires_at?: string | null;
  expired?: boolean;
  updated_at?: string | null;
}

export interface WhatsAppIntegrationStatus {
  connected: boolean;
  waba_id?: string | null;
  phone_number_id?: string | null;
  display_phone_number?: string | null;
  verified_name?: string | null;
  token_expires_at?: string | null;
  expired?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface IntegrationStatus {
  tenant_id: string | null;
  google: GoogleIntegrationStatus;
  facebook: FacebookIntegrationStatus;
  whatsapp: WhatsAppIntegrationStatus;
}

const EMPTY_STATUS: IntegrationStatus = {
  tenant_id: null,
  google: { connected: false },
  facebook: { connected: false },
  whatsapp: { connected: false },
};

export async function fetchIntegrationStatus(): Promise<IntegrationStatus> {
  const { data, error } = await supabase.rpc("get_integration_status");
  if (error) throw error;
  const parsed = (data ?? {}) as Partial<IntegrationStatus>;
  return {
    tenant_id: parsed.tenant_id ?? null,
    google: parsed.google ?? { connected: false },
    facebook: parsed.facebook ?? { connected: false },
    whatsapp: parsed.whatsapp ?? { connected: false },
  };
}

export function useIntegrationStatus(enabled = true) {
  const [status, setStatus] = useState<IntegrationStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await fetchIntegrationStatus());
    } catch (err) {
      console.error("Errore nel recupero dello stato integrazioni", err);
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
      setStatus(EMPTY_STATUS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void refetch();
  }, [enabled, refetch]);

  return { status, loading, error, refetch };
}
