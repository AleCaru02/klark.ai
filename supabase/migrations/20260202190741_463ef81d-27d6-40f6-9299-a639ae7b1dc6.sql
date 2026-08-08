-- Allow customers to update their own tenant name
CREATE POLICY "Customers can update own tenant"
ON public.tenants
FOR UPDATE
USING (user_belongs_to_tenant(auth.uid(), id))
WITH CHECK (user_belongs_to_tenant(auth.uid(), id));