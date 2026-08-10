-- rotate_site_chatbot_key disables the chatbot, revokes active sessions and
-- rotates the public key. Treat it as a privileged tenant mutation rather than
-- allowing every tenant member to execute it.

create or replace function public.rotate_site_chatbot_key(p_chatbot_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_chatbot public.site_chatbots%rowtype;
  v_key uuid := gen_random_uuid();
  v_user uuid := auth.uid();
  v_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  select * into v_chatbot
  from public.site_chatbots
  where id = p_chatbot_id;

  if not found then
    raise exception 'Chatbot not found';
  end if;

  if v_role <> 'service_role' then
    if v_user is null then
      raise exception 'Authentication required';
    end if;

    if not public.is_platform_admin(v_user)
      and not exists (
        select 1
        from public.memberships m
        where m.user_id = v_user
          and m.tenant_id = v_chatbot.tenant_id
          and m.role = 'admin'
      ) then
      raise exception 'Tenant admin required';
    end if;
  end if;

  update public.site_chatbots
  set public_key = v_key,
      is_enabled = false,
      updated_at = now()
  where id = p_chatbot_id;

  update public.site_chat_sessions
  set status = 'revoked',
      last_seen_at = now()
  where chatbot_id = p_chatbot_id
    and status = 'active';

  insert into public.audit_log (tenant_id, actor_user_id, action, payload_json)
  values (
    v_chatbot.tenant_id,
    v_user,
    'site_chatbot.key_rotated',
    jsonb_build_object('chatbot_id', p_chatbot_id, 'disabled_after_rotation', true)
  );

  return v_key;
end;
$function$;

revoke execute on function public.rotate_site_chatbot_key(uuid) from public, anon;
grant execute on function public.rotate_site_chatbot_key(uuid) to authenticated, service_role;
