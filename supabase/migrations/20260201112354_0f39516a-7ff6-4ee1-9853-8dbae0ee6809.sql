
-- Add last_activity_at to contacts if not exists (already has updated_at but we need explicit tracking)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT now();

-- Create source enum
DO $$ BEGIN
  CREATE TYPE public.contact_source AS ENUM ('facebook_leadads', 'contact_form', 'manual', 'import');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create form provider enum
DO $$ BEGIN
  CREATE TYPE public.form_provider AS ENUM ('facebook', 'internal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Contact sources table
CREATE TABLE IF NOT EXISTS public.contact_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  source public.contact_source NOT NULL DEFAULT 'manual',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(contact_id)
);

ALTER TABLE public.contact_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on contact_sources"
  ON public.contact_sources FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can manage own tenant contact_sources"
  ON public.contact_sources FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Lead form answers table
CREATE TABLE IF NOT EXISTS public.lead_form_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  form_provider public.form_provider NOT NULL DEFAULT 'internal',
  form_id text,
  answers_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_form_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on lead_form_answers"
  ON public.lead_form_answers FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can manage own tenant lead_form_answers"
  ON public.lead_form_answers FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Pipelines table
CREATE TABLE IF NOT EXISTS public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Pipeline Principale',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on pipelines"
  ON public.pipelines FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can manage own tenant pipelines"
  ON public.pipelines FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Stages table
CREATE TABLE IF NOT EXISTS public.stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on stages"
  ON public.stages FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can manage own tenant stages"
  ON public.stages FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Contact stages table (junction)
CREATE TABLE IF NOT EXISTS public.contact_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(contact_id)
);

ALTER TABLE public.contact_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on contact_stages"
  ON public.contact_stages FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can manage own tenant contact_stages"
  ON public.contact_stages FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Lead notes table
CREATE TABLE IF NOT EXISTS public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on lead_notes"
  ON public.lead_notes FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can manage own tenant lead_notes"
  ON public.lead_notes FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Create trigger for lead_notes updated_at
CREATE TRIGGER update_lead_notes_updated_at
  BEFORE UPDATE ON public.lead_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for contact_stages updated_at
CREATE OR REPLACE FUNCTION public.update_contact_stage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  -- Also update contact's last_activity_at
  UPDATE public.contacts SET last_activity_at = now() WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_contact_stages_timestamp
  BEFORE UPDATE ON public.contact_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contact_stage_timestamp();
