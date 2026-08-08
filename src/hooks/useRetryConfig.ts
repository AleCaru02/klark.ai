import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface RetryConfig {
  max_attempts: number;
  retry_after_hours: number;
  send_whatsapp_on_no_answer: boolean;
}

const defaultRetryConfig: RetryConfig = {
  max_attempts: 5,
  retry_after_hours: 4,
  send_whatsapp_on_no_answer: true,
};

export function useRetryConfig() {
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;
  const queryClient = useQueryClient();

  const { data: retryConfig, isLoading, error } = useQuery({
    queryKey: ["retry_config", tenantId],
    queryFn: async () => {
      if (!tenantId) return defaultRetryConfig;

      const { data, error } = await supabase
        .from("settings")
        .select("retry_config_json")
        .eq("tenant_id", tenantId)
        .single();

      if (error) throw error;

      const config = data?.retry_config_json as Record<string, unknown> | null;
      
      return {
        max_attempts: (config?.max_attempts as number) || defaultRetryConfig.max_attempts,
        retry_after_hours: (config?.retry_after_hours as number) || defaultRetryConfig.retry_after_hours,
        send_whatsapp_on_no_answer: config?.send_whatsapp_on_no_answer !== false,
      } as RetryConfig;
    },
    enabled: !!tenantId,
  });

  const updateConfig = useMutation({
    mutationFn: async (newConfig: RetryConfig) => {
      if (!tenantId) throw new Error("No tenant");

      const configJson = {
        max_attempts: newConfig.max_attempts,
        retry_after_hours: newConfig.retry_after_hours,
        send_whatsapp_on_no_answer: newConfig.send_whatsapp_on_no_answer,
      };

      const { error } = await supabase
        .from("settings")
        .update({ retry_config_json: configJson })
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retry_config", tenantId] });
      toast.success("Configurazione salvata");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  return {
    retryConfig: retryConfig || defaultRetryConfig,
    isLoading,
    error,
    updateConfig,
  };
}
