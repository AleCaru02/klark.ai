-- MVP Calendar hardening: DB-level overlap protection for concurrent booking requests.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_no_active_overlap'
      AND conrelid = 'public.appointments'::regclass
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_no_active_overlap
      EXCLUDE USING gist (
        tenant_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      )
      WHERE (status IN ('scheduled', 'confirmed', 'rescheduled'));
  END IF;
END
$$;
