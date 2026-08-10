-- Read the already-provisioned pilot runtime API key from Vault without
-- exposing it to browser roles. The Edge runtime supplies the expected
-- subaccount SID and receives credentials only when it matches the stored
-- pilot subaccount.

create or replace function public.get_twilio_runtime_credentials(p_subaccount_sid text)
returns table(api_key_sid text, api_key_secret text)
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  stored_subaccount_sid text;
  stored_api_key_sid text;
  stored_api_key_secret text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;

  if p_subaccount_sid is null or p_subaccount_sid !~ '^AC[0-9A-Fa-f]{32}$' then
    raise exception 'Invalid Twilio subaccount SID';
  end if;

  select decrypted_secret
    into stored_subaccount_sid
  from vault.decrypted_secrets
  where name = 'twilio_pilot_subaccount_sid'
  order by updated_at desc
  limit 1;

  if stored_subaccount_sid is null or stored_subaccount_sid <> p_subaccount_sid then
    raise exception 'No runtime credentials configured for Twilio subaccount';
  end if;

  select decrypted_secret
    into stored_api_key_sid
  from vault.decrypted_secrets
  where name = 'twilio_pilot_api_key_sid'
  order by updated_at desc
  limit 1;

  select decrypted_secret
    into stored_api_key_secret
  from vault.decrypted_secrets
  where name = 'twilio_pilot_api_key_secret'
  order by updated_at desc
  limit 1;

  if stored_api_key_sid is null
    or stored_api_key_sid !~ '^SK[0-9A-Fa-f]{32}$'
    or stored_api_key_secret is null
    or length(stored_api_key_secret) < 16 then
    raise exception 'Twilio runtime credentials are incomplete';
  end if;

  return query select stored_api_key_sid, stored_api_key_secret;
end;
$function$;

revoke all on function public.get_twilio_runtime_credentials(text) from public, anon, authenticated;
grant execute on function public.get_twilio_runtime_credentials(text) to service_role;
