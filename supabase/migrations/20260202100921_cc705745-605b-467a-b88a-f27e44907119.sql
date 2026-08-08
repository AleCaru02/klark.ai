-- Create storage bucket for tenant knowledge PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-knowledge', 'tenant-knowledge', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for tenant-knowledge bucket
CREATE POLICY "Admins can manage all tenant-knowledge files"
ON storage.objects FOR ALL
USING (bucket_id = 'tenant-knowledge' AND public.has_membership_role(auth.uid(), 'admin'::public.membership_role))
WITH CHECK (bucket_id = 'tenant-knowledge' AND public.has_membership_role(auth.uid(), 'admin'::public.membership_role));

CREATE POLICY "Customers can manage own tenant knowledge files"
ON storage.objects FOR ALL
USING (
  bucket_id = 'tenant-knowledge' 
  AND public.user_belongs_to_tenant(auth.uid(), (storage.foldername(name))[1]::uuid)
)
WITH CHECK (
  bucket_id = 'tenant-knowledge' 
  AND public.user_belongs_to_tenant(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Create tenant_knowledge table for storing knowledge sources
CREATE TABLE public.tenant_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'website')),
  source_name TEXT NOT NULL,
  source_url TEXT,
  storage_path TEXT,
  content_text TEXT,
  content_summary TEXT,
  page_count INTEGER,
  crawled_pages INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_knowledge ENABLE ROW LEVEL SECURITY;

-- RLS policies for tenant_knowledge
CREATE POLICY "Admins can do everything on tenant_knowledge"
ON public.tenant_knowledge FOR ALL
USING (public.has_membership_role(auth.uid(), 'admin'::public.membership_role));

CREATE POLICY "Customers can manage own tenant knowledge"
ON public.tenant_knowledge FOR ALL
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id))
WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- Create trigger for updated_at
CREATE TRIGGER update_tenant_knowledge_updated_at
BEFORE UPDATE ON public.tenant_knowledge
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_tenant_knowledge_tenant_id ON public.tenant_knowledge(tenant_id);
CREATE INDEX idx_tenant_knowledge_status ON public.tenant_knowledge(status);