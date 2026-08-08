BEGIN;

DO $$
DECLARE
  v_tenant uuid := '00000000-0000-4000-8000-000000000901';
BEGIN
  INSERT INTO public.tenants(id, name) VALUES (v_tenant, 'Calendar CI tenant');

  INSERT INTO public.appointments(tenant_id, title, start_at, end_at, status)
  VALUES (v_tenant, 'Slot A', '2035-01-15T10:00:00Z', '2035-01-15T10:30:00Z', 'scheduled');

  BEGIN
    INSERT INTO public.appointments(tenant_id, title, start_at, end_at, status)
    VALUES (v_tenant, 'Overlapping slot', '2035-01-15T10:15:00Z', '2035-01-15T10:45:00Z', 'scheduled');
    RAISE EXCEPTION 'Expected exclusion_violation for overlapping active appointments';
  EXCEPTION
    WHEN exclusion_violation THEN NULL;
  END;

  INSERT INTO public.appointments(tenant_id, title, start_at, end_at, status)
  VALUES (v_tenant, 'Adjacent slot', '2035-01-15T10:30:00Z', '2035-01-15T11:00:00Z', 'scheduled');
END
$$;

ROLLBACK;
