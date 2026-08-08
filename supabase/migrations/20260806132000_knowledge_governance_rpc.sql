create or replace function public.set_knowledge_source_governance(
  p_source_id uuid,
  p_action text,
  p_expires_at timestamptz default null,
  p_checksum text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row public.tenant_knowledge%rowtype;
  next_version integer;
  event_action text;
  next_status text;
begin
  select * into source_row
  from public.tenant_knowledge
  where id = p_source_id;

  if not found then
    raise exception 'Knowledge source not found';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = source_row.tenant_id
      and m.role = 'admin'
  ) then
    raise exception 'Only tenant administrators can govern knowledge sources';
  end if;

  if p_action not in ('approved', 'revoked', 'reviewed') then
    raise exception 'Unsupported governance action';
  end if;

  select count(*)::integer + 1 into next_version
  from public.audit_log al
  where al.tenant_id = source_row.tenant_id
    and al.action = 'knowledge.source_approved'
    and al.payload_json ->> 'source_id' = p_source_id::text;

  if p_action = 'approved' then
    if source_row.status not in ('pending_review', 'completed') then
      raise exception 'Source must be processed before approval';
    end if;
    if p_expires_at is not null and p_expires_at <= now() then
      raise exception 'Approval expiry must be in the future';
    end if;
    event_action := 'knowledge.source_approved';
    next_status := 'completed';
  elsif p_action = 'revoked' then
    event_action := 'knowledge.source_revoked';
    next_status := 'pending_review';
  else
    event_action := 'knowledge.source_reviewed';
    next_status := source_row.status;
  end if;

  insert into public.audit_log (
    tenant_id,
    actor_user_id,
    action,
    payload_json
  ) values (
    source_row.tenant_id,
    auth.uid(),
    event_action,
    jsonb_build_object(
      'source_id', source_row.id,
      'source_name', source_row.source_name,
      'source_type', source_row.source_type,
      'version', next_version,
      'checksum', nullif(trim(coalesce(p_checksum, '')), ''),
      'expires_at', p_expires_at,
      'note', nullif(trim(coalesce(p_note, '')), ''),
      'recorded_at', now()
    )
  );

  update public.tenant_knowledge
  set status = next_status,
      updated_at = now()
  where id = source_row.id;

  return jsonb_build_object(
    'source_id', source_row.id,
    'status', next_status,
    'version', next_version,
    'action', event_action
  );
end;
$$;

revoke all on function public.set_knowledge_source_governance(uuid, text, timestamptz, text, text) from public;
grant execute on function public.set_knowledge_source_governance(uuid, text, timestamptz, text, text) to authenticated;
