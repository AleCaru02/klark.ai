import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PhoneNumber {
  id: string;
  tenant_id: string | null;
  phone_number: string;
  phone_type: "voice" | "whatsapp";
  twilio_sid: string | null;
  twilio_subaccount_sid: string | null;
  country_code: string;
  status: "active" | "inactive" | "pending";
  provider_status: "pending" | "provisioning" | "verified" | "error" | "suspended" | "released";
  provider_account_owner: "platform" | "customer";
  verified_at: string | null;
  provisioning_error: string | null;
  monthly_cost_cents: number;
  created_at: string;
  updated_at: string;
  tenant?: { id: string; name: string } | null;
}

export interface CreatePhoneNumberInput {
  tenant_id: string;
  phone_number: string;
  phone_type: "voice" | "whatsapp";
  twilio_sid?: string;
  twilio_subaccount_sid?: string;
  provider_account_owner?: "platform" | "customer";
  provider_status?: PhoneNumber["provider_status"];
  country_code?: string;
  monthly_cost_cents?: number;
}

export function usePhoneNumbers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Types are regenerated after migrations in the release pipeline. The cast
  // keeps the branch compilable while new additive columns are introduced.
  const db = supabase as any;

  const { data: phoneNumbers = [], isLoading, error } = useQuery({
    queryKey: ["phone-numbers"],
    queryFn: async () => {
      const { data, error } = await db
        .from("tenant_phone_numbers")
        .select("*, tenant:tenants(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PhoneNumber[];
    },
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ["tenants-list"],
    queryFn: async () => {
      const { data, error } = await db.from("tenants").select("id, name").order("name");
      if (error) throw error;
      return data as Array<{ id: string; name: string }>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreatePhoneNumberInput) => {
      const providerStatus = input.provider_status || "pending";
      const { data, error } = await db
        .from("tenant_phone_numbers")
        .insert({
          tenant_id: input.tenant_id,
          phone_number: input.phone_number,
          phone_type: input.phone_type,
          twilio_sid: input.twilio_sid || null,
          twilio_subaccount_sid: input.twilio_subaccount_sid || null,
          provider_account_owner: input.provider_account_owner || (input.phone_type === "voice" ? "platform" : "customer"),
          provider_status: providerStatus,
          country_code: input.country_code || "IT",
          monthly_cost_cents: input.monthly_cost_cents || 0,
          status: providerStatus === "verified" ? "active" : "pending",
          verified_at: providerStatus === "verified" ? new Date().toISOString() : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as PhoneNumber;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
      toast({ title: "Numero registrato", description: "Il numero diventa attivo solo dopo la verifica del provider." });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message.includes("unique") ? "Il cliente ha già un numero di questo tipo" : error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PhoneNumber> & { id: string }) => {
      const nextUpdates = {
        ...updates,
        ...(updates.provider_status === "verified"
          ? { status: "active", verified_at: updates.verified_at || new Date().toISOString(), provisioning_error: null }
          : {}),
        ...(updates.provider_status === "error" ? { status: "inactive" } : {}),
      };
      const { data, error } = await db
        .from("tenant_phone_numbers")
        .update(nextUpdates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as PhoneNumber;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
      toast({ title: "Numero aggiornato", description: "Le modifiche sono state salvate" });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Errore", description: error.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const number = phoneNumbers.find((item) => item.id === id);
      if (number?.provider_status === "verified" && number.provider_account_owner === "platform") {
        throw new Error("Rilascia prima il numero dal provider: eliminare solo il record lascerebbe una risorsa Twilio attiva e fatturata.");
      }
      const { error } = await db.from("tenant_phone_numbers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
      toast({ title: "Numero rimosso", description: "Il record è stato eliminato" });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Errore", description: error.message }),
  });

  const stats = {
    total: phoneNumbers.length,
    active: phoneNumbers.filter((number) => number.provider_status === "verified").length,
    inactive: phoneNumbers.filter((number) => ["error", "suspended", "released"].includes(number.provider_status)).length,
    pending: phoneNumbers.filter((number) => ["pending", "provisioning"].includes(number.provider_status)).length,
    monthlyTotal: phoneNumbers.reduce((sum, number) => sum + number.monthly_cost_cents / 100, 0),
  };

  return {
    phoneNumbers,
    tenants,
    stats,
    isLoading,
    error,
    createPhoneNumber: createMutation.mutateAsync,
    updatePhoneNumber: updateMutation.mutateAsync,
    deletePhoneNumber: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
