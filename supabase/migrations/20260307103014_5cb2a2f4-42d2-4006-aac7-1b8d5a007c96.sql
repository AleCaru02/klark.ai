
-- Add feature_flags jsonb column to plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb;
