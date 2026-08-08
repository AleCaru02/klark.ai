CREATE POLICY "Authenticated can view null-tenant audit_log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (tenant_id IS NULL);