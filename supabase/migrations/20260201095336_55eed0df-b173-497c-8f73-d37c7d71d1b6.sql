-- ============================================
-- CALENDARIO: Aggiornamento Schema Supabase
-- ============================================

-- 1) Aggiungere colonne mancanti a google_tokens (già esiste con tenant_id)
ALTER TABLE public.google_tokens 
ADD COLUMN IF NOT EXISTS calendar_id text DEFAULT 'primary',
ADD COLUMN IF NOT EXISTS scope text DEFAULT 'https://www.googleapis.com/auth/calendar';

-- 2) Aggiungere colonne mancanti a appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Rome',
ADD COLUMN IF NOT EXISTS google_calendar_id text,
ADD COLUMN IF NOT EXISTS created_from text DEFAULT 'app',
ADD COLUMN IF NOT EXISTS replaced_by_id uuid REFERENCES public.appointments(id);

-- Aggiungere constraint CHECK per created_from
ALTER TABLE public.appointments 
ADD CONSTRAINT appointments_created_from_check 
CHECK (created_from IN ('app', 'google', 'voice', 'whatsapp'));

-- 3) Creare tabella appointments_history per tracciare spostamenti
CREATE TABLE IF NOT EXISTS public.appointments_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  old_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  new_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  reason text,
  changed_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Commenti per documentazione
COMMENT ON TABLE public.appointments_history IS 'Traccia lo storico delle modifiche agli appuntamenti (spostamenti, cancellazioni)';
COMMENT ON COLUMN public.appointments_history.reason IS 'Motivo dello spostamento o cancellazione';
COMMENT ON COLUMN public.appointments_history.changed_by_user_id IS 'ID utente che ha effettuato la modifica (null se automatica)';

-- 4) Abilitare RLS su appointments_history
ALTER TABLE public.appointments_history ENABLE ROW LEVEL SECURITY;

-- 5) Creare policy RLS per appointments_history
CREATE POLICY "Admins can do everything on appointments_history"
ON public.appointments_history FOR ALL
USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can view own tenant appointments_history"
ON public.appointments_history FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Customers can insert own tenant appointments_history"
ON public.appointments_history FOR INSERT
WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

-- 6) Creare indici per performance
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_start 
ON public.appointments(tenant_id, start_at);

CREATE INDEX IF NOT EXISTS idx_appointments_calendar_event 
ON public.appointments(calendar_event_id) 
WHERE calendar_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_google_calendar 
ON public.appointments(google_calendar_id) 
WHERE google_calendar_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_status 
ON public.appointments(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_appointments_history_tenant 
ON public.appointments_history(tenant_id);

CREATE INDEX IF NOT EXISTS idx_appointments_history_old 
ON public.appointments_history(old_appointment_id) 
WHERE old_appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_google_tokens_tenant 
ON public.google_tokens(tenant_id);

-- 7) Trigger per updated_at su appointments (se non esiste già)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_appointments_updated_at'
  ) THEN
    CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;