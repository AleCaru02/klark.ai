import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const CANDIDATE_SUPABASE_URL = "https://ipazbzctivqquwndifxh.supabase.co";
// Publishable keys are intentionally safe for browser use. Authorization remains enforced by RLS.
const CANDIDATE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WVqZ-6gb2SutSOpqqFY_6w_YPUwmOp5";

const isCandidateVercelHost =
  typeof window !== "undefined" &&
  /^clerkai-preview-alecaru02(?:-|\.)/.test(window.location.hostname);

const configuredUrl =
  import.meta.env.VITE_SUPABASE_URL?.trim() ||
  (isCandidateVercelHost ? CANDIDATE_SUPABASE_URL : undefined);
const configuredPublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  (isCandidateVercelHost ? CANDIDATE_SUPABASE_PUBLISHABLE_KEY : undefined);

export const isSupabaseConfigured = Boolean(
  configuredUrl &&
    /^https:\/\//i.test(configuredUrl) &&
    configuredPublishableKey &&
    configuredPublishableKey.length >= 20,
);

// Permette alla landing e alle pagine informative di caricarsi in una preview
// senza backend. AuthProvider impedisce qualsiasi chiamata applicativa quando
// isSupabaseConfigured è false. La preview candidata Vercel usa esclusivamente
// il backend candidato finché le variabili build-time non vengono configurate sul progetto.
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
