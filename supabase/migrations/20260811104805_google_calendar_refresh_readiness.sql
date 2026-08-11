create or replace function public.get_integration_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_tenant uuid;
  v_google jsonb := jsonb_build_object('connected', false);
  v_facebook jsonb := jsonb_build_object('connected', false);
  v_whatsapp jsonb := jsonb_build_object('connected', false);
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select tenant_id into v_tenant
  from public.memberships
  where user_id = v_user
  limit 1;

  if v_tenant is null then
    select tenant_id into v_tenant
    from public.profiles
    where id = v_user
    limit 1;
  end if;

  if v_tenant is null then
    return jsonb_build_object(
      'tenant_id', null,
      'google', v_google,
      'facebook', v_facebook,
      'whatsapp', v_whatsapp
    );
  end if;

  select jsonb_build_object(
    'connected', (nullif(trim(coalesce(g.calendar_id, '')), '') is not null),
    'calendar_id', g.calendar_id,
    'scope', g.scope,
    'token_expires_at', g.token_expires_at,
    -- `expired` means the integration needs reconnection. An expired access
    -- token remains usable when an OAuth refresh token is available because
    -- the server refresh path renews it on demand.
    'expired', (
      g.token_expires_at is not null
      and g.token_expires_at <= now()
      and nullif(trim(coalesce(g.refresh_token, '')), '') is null
    ),
    'access_token_expired', (
      g.token_expires_at is not null
      and g.token_expires_at <= now()
    ),
    'refresh_available', (nullif(trim(coalesce(g.refresh_token, '')), '') is not null),
    'updated_at', g.updated_at
  ) into v_google
  from public.google_tokens g
  where g.tenant_id = v_tenant;

  select jsonb_build_object(
    'connected', true,
    'page_id', case when f.page_id = '__pending__' then null else f.page_id end,
    'pending_page_selection', (f.page_id = '__pending__'),
    'token_expires_at', f.token_expires_at,
    'expired', (f.token_expires_at is not null and f.token_expires_at <= now()),
    'updated_at', f.updated_at
  ) into v_facebook
  from public.facebook_integrations f
  where f.tenant_id = v_tenant;

  select jsonb_build_object(
    'connected', true,
    'waba_id', w.waba_id,
    'phone_number_id', w.phone_number_id,
    'display_phone_number', w.display_phone_number,
    'verified_name', w.verified_name,
    'token_expires_at', w.token_expires_at,
    'expired', (w.token_expires_at is not null and w.token_expires_at <= now()),
    'created_at', w.created_at,
    'updated_at', w.updated_at
  ) into v_whatsapp
  from public.whatsapp_integrations w
  where w.tenant_id = v_tenant;

  return jsonb_build_object(
    'tenant_id', v_tenant,
    'google', coalesce(v_google, jsonb_build_object('connected', false)),
    'facebook', coalesce(v_facebook, jsonb_build_object('connected', false)),
    'whatsapp', coalesce(v_whatsapp, jsonb_build_object('connected', false))
  );
end;
$function$;