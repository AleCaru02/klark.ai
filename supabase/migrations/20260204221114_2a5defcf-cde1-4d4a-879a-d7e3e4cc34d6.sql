-- facebook_form_questions: domande per ogni form
CREATE TABLE public.facebook_form_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES public.facebook_forms(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  question_label TEXT NOT NULL,
  question_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- facebook_form_submissions: submission grezze
CREATE TABLE public.facebook_form_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES public.facebook_forms(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  leadgen_id TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- facebook_form_answers: risposte parsate
CREATE TABLE public.facebook_form_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES public.facebook_form_submissions(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  question_label TEXT NOT NULL,
  answer_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_form_questions_form ON public.facebook_form_questions(form_id);
CREATE INDEX idx_form_submissions_form ON public.facebook_form_submissions(form_id);
CREATE INDEX idx_form_submissions_contact ON public.facebook_form_submissions(contact_id);
CREATE INDEX idx_form_answers_submission ON public.facebook_form_answers(submission_id);
CREATE UNIQUE INDEX idx_form_questions_unique ON public.facebook_form_questions(form_id, question_key);

-- Enable RLS
ALTER TABLE public.facebook_form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_form_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for facebook_form_questions
CREATE POLICY "Admins can do everything on facebook_form_questions"
  ON public.facebook_form_questions FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can manage own tenant facebook_form_questions"
  ON public.facebook_form_questions FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- RLS Policies for facebook_form_submissions
CREATE POLICY "Admins can do everything on facebook_form_submissions"
  ON public.facebook_form_submissions FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can manage own tenant facebook_form_submissions"
  ON public.facebook_form_submissions FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- RLS Policies for facebook_form_answers
CREATE POLICY "Admins can do everything on facebook_form_answers"
  ON public.facebook_form_answers FOR ALL
  USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can manage own tenant facebook_form_answers"
  ON public.facebook_form_answers FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));