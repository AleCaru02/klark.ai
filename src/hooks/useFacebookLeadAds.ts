import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface FacebookIntegrationStatus {
  env_configured: boolean;
  connected: boolean;
  integration: {
    page_id: string;
    form_id: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  stats: {
    total_imports: number;
  };
  recent_imports: Array<{
    id: string;
    leadgen_id: string;
    form_id: string | null;
    imported_at: string;
    contacts: {
      id: string;
      name: string;
      email: string | null;
      phone_e164: string | null;
    } | null;
  }>;
}

export function useFacebookLeadAds() {
  const { session, membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["facebook-leadads-status", tenantId],
    queryFn: async (): Promise<FacebookIntegrationStatus> => {
      if (!tenantId) {
        return {
          env_configured: false,
          connected: false,
          integration: null,
          stats: { total_imports: 0 },
          recent_imports: [],
        };
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        throw new Error("No session");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-leadads-status?tenant_id=${tenantId}`,
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch status");
      }

      return response.json();
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Refresh every 30s
  });

  const syncNow = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        throw new Error("No session");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-leadads-pull?tenant_id=${tenantId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["facebook-leadads-status"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      toast({
        title: "Sincronizzazione completata",
        description: `${data.imported_count} lead importati, ${data.skipped_count} già presenti`,
      });
    },
    onError: (error) => {
      toast({
        title: "Errore sincronizzazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const connect = async () => {
    if (!session?.access_token) {
      toast({
        title: "Errore",
        description: "Devi essere autenticato",
        variant: "destructive",
      });
      return;
    }

    setConnecting(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-leadads-auth-start`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start auth");
      }

      const data = await response.json();

      if (data?.auth_url) {
        window.location.href = data.auth_url;
      } else {
        throw new Error("No auth URL returned");
      }
    } catch (error: any) {
      console.error("Error starting Facebook auth:", error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante la connessione",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!session?.access_token) {
      toast({
        title: "Errore",
        description: "Devi essere autenticato",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-leadads-disconnect`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to disconnect");
      }

      queryClient.invalidateQueries({ queryKey: ["facebook-leadads-status"] });
      toast({
        title: "Disconnesso",
        description: "Facebook Lead Ads disconnesso con successo",
      });
    } catch (error: any) {
      console.error("Error disconnecting Facebook:", error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante la disconnessione",
        variant: "destructive",
      });
    }
  };

  return {
    status,
    isLoading,
    syncNow,
    envConfigured: status?.env_configured ?? false,
    connected: status?.connected ?? false,
    integration: status?.integration,
    recentImports: status?.recent_imports ?? [],
    totalImports: status?.stats?.total_imports ?? 0,
    connect,
    disconnect,
    connecting,
    refetch,
  };
}
