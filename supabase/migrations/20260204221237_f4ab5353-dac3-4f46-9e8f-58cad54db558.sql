-- Add slug column to tenants for URL-friendly identification
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug) WHERE slug IS NOT NULL;

-- Add submission_id to contacts to link to the facebook submission
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES public.facebook_form_submissions(id) ON DELETE SET NULL;

-- Create index for submission lookup
CREATE INDEX IF NOT EXISTS idx_contacts_submission ON public.contacts(submission_id) WHERE submission_id IS NOT NULL;