import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredPublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(
  configuredUrl &&
    /^https:\/\//i.test(configuredUrl) &&
    configuredPublishableKey &&
    configuredPublishableKey.length >= 20,
);

// Permette alla landing e alle pagine informative di caricarsi in una preview
// senza backend. AuthProvider impedisce qualsiasi chiamata applicativa quando
// isSupabaseConfigured è false.
const SUPABASE_URL = isSupabaseConfigured
  ? configuredUrl!
  : "https://backend-not-configured.invalid";
const SUPABASE_PUBLISHABLE_KEY = isSupabaseConfigured
  ? configuredPublishableKey!
  : "preview-backend-not-configured";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
