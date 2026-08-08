-- Reconcile current commercial configuration: standard Fase 1 plans have no separate setup fee.
update public.plans
set setup_fee_cents = 0
where code in ('essential','growth','pro','enterprise')
  and setup_fee_cents is distinct from 0;
