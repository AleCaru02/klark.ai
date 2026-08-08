
-- Function to ensure all contacts have a stage assignment
-- Called periodically or on demand to fix orphaned contacts
CREATE OR REPLACE FUNCTION public.fix_contacts_without_stage()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fixed_count integer := 0;
  rec record;
  target_stage_id uuid;
BEGIN
  -- Find contacts without a contact_stages entry
  FOR rec IN
    SELECT c.id AS contact_id, c.tenant_id
    FROM public.contacts c
    LEFT JOIN public.contact_stages cs ON cs.contact_id = c.id
    WHERE cs.id IS NULL
  LOOP
    -- Find the first active stage with stage_type='new_lead' for this tenant's pipeline
    SELECT s.id INTO target_stage_id
    FROM public.stages s
    JOIN public.pipelines p ON p.id = s.pipeline_id
    WHERE p.tenant_id = rec.tenant_id
      AND s.stage_type = 'new_lead'
      AND s.is_active = true
    ORDER BY s.position ASC
    LIMIT 1;

    -- If no new_lead stage, use any first active stage
    IF target_stage_id IS NULL THEN
      SELECT s.id INTO target_stage_id
      FROM public.stages s
      JOIN public.pipelines p ON p.id = s.pipeline_id
      WHERE p.tenant_id = rec.tenant_id
        AND s.is_active = true
      ORDER BY s.position ASC
      LIMIT 1;
    END IF;

    -- If we found a stage, assign it
    IF target_stage_id IS NOT NULL THEN
      INSERT INTO public.contact_stages (tenant_id, contact_id, stage_id)
      VALUES (rec.tenant_id, rec.contact_id, target_stage_id)
      ON CONFLICT DO NOTHING;
      fixed_count := fixed_count + 1;
    END IF;
  END LOOP;

  RETURN fixed_count;
END;
$$;
