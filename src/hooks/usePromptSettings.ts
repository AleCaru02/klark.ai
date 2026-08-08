import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Json } from "@/integrations/supabase/types";

export interface SimplePromptConfig {
  sector: string;
  description: string;
  faq: string;
  objections: string;
  forbiddenWords: string;
  tone: string;
  formality: string;
  languages: string[];
}

export interface AdvancedPromptConfig {
  prompt: string;
  enabledTools: string[];
}

export interface AIPromptConfig {
  mode: "simple" | "advanced";
  simple: SimplePromptConfig;
  advanced: AdvancedPromptConfig;
  generatedPrompt?: string;
}

export interface RetryConfig {
  max_attempts: number;
  retry_after_hours: number;
  send_whatsapp_on_no_answer: boolean;
}

const DEFAULT_SIMPLE_CONFIG: SimplePromptConfig = {
  sector: "Studio Legale",
  description: "",
  faq: "",
  objections: "",
  forbiddenWords: "",
  tone: "standard",
  formality: "lei",
  languages: ["it"],
};

const DEFAULT_ADVANCED_CONFIG: AdvancedPromptConfig = {
  prompt: "",
  enabledTools: ["book_appointment", "reschedule", "cancel", "check_availability", "get_info"],
};

const DEFAULT_AI_PROMPT: AIPromptConfig = {
  mode: "simple",
  simple: DEFAULT_SIMPLE_CONFIG,
  advanced: DEFAULT_ADVANCED_CONFIG,
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  max_attempts: 5,
  retry_after_hours: 4,
  send_whatsapp_on_no_answer: true,
};

function parseAIPrompt(json: Json | null): AIPromptConfig {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return DEFAULT_AI_PROMPT;
  }
  const obj = json as Record<string, Json>;
  return {
    mode: (obj.mode as "simple" | "advanced") || "simple",
    simple: (obj.simple as unknown as SimplePromptConfig) || DEFAULT_SIMPLE_CONFIG,
    advanced: (obj.advanced as unknown as AdvancedPromptConfig) || DEFAULT_ADVANCED_CONFIG,
    generatedPrompt: obj.generatedPrompt as string | undefined,
  };
}

function parseRetryConfig(json: Json | null): RetryConfig {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return DEFAULT_RETRY_CONFIG;
  }
  const obj = json as Record<string, Json>;
  return {
    max_attempts: (obj.max_attempts as number) || 5,
    retry_after_hours: (obj.retry_after_hours as number) || 4,
    send_whatsapp_on_no_answer: obj.send_whatsapp_on_no_answer !== false,
  };
}

export function usePromptSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { membership } = useAuth();
  const tenantId = membership?.tenant_id;

  // Fetch settings
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["prompt-settings", tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error("No tenant ID");

      const { data, error } = await supabase
        .from("settings")
        .select("ai_prompt_json, retry_config_json, tone, formality, language_voice")
        .eq("tenant_id", tenantId)
        .single();

      if (error) throw error;
      
      return {
        aiPrompt: parseAIPrompt(data.ai_prompt_json),
        retryConfig: parseRetryConfig(data.retry_config_json),
        tone: data.tone,
        formality: data.formality,
        languageVoice: data.language_voice,
      };
    },
    enabled: !!tenantId,
  });

  // Save AI prompt config
  const savePromptMutation = useMutation({
    mutationFn: async (config: AIPromptConfig) => {
      if (!tenantId) throw new Error("No tenant ID");

      const { error } = await supabase
        .from("settings")
        .update({
          ai_prompt_json: config as unknown as Json,
          tone: config.simple.tone as "standard" | "formale" | "amichevole",
          formality: config.simple.formality as "tu" | "lei",
        })
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompt-settings", tenantId] });
      toast({
        title: "Configurazione salvata",
        description: "Il prompt AI è stato aggiornato",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    },
  });

  // Save retry config
  const saveRetryConfigMutation = useMutation({
    mutationFn: async (config: RetryConfig) => {
      if (!tenantId) throw new Error("No tenant ID");

      const { error } = await supabase
        .from("settings")
        .update({
          retry_config_json: config as unknown as Json,
        })
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompt-settings", tenantId] });
      toast({
        title: "Configurazione salvata",
        description: "Le impostazioni retry sono state aggiornate",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    },
  });

  return {
    aiPrompt: settings?.aiPrompt || DEFAULT_AI_PROMPT,
    retryConfig: settings?.retryConfig || DEFAULT_RETRY_CONFIG,
    isLoading,
    error,
    savePrompt: savePromptMutation.mutateAsync,
    saveRetryConfig: saveRetryConfigMutation.mutateAsync,
    isSaving: savePromptMutation.isPending || saveRetryConfigMutation.isPending,
  };
}
