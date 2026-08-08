-- Extend appointment_status enum to include confirmed, completed, no_show
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'no_show';