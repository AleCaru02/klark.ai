begin;

-- Normal authenticated tenants must not be able to call the operational RPC.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-1111-4111-8111-aaaaaaaa1111","role":"authenticated"}',
  true
);
do $$
begin
  begin
    perform public.get_mvp_operational_health();
    raise exception 'authenticated tenant unexpectedly accessed operational health';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);

do $$
declare
  result jsonb;
begin
  result := public.get_mvp_operational_health();
  if result->'queue_worker'->>'status' not in ('not_started','stale','error','ok') then
    raise exception 'unexpected queue health status';
  end if;
  if result->'signals_15m' is null then
    raise exception 'missing provider signal summary';
  end if;
end $$;

reset role;
rollback;
