-- A processed customer document is content, not automatically trusted runtime
-- knowledge. Track approval explicitly and support the pending_review state used
-- by the governance UI/RPC.

alter table public.tenant_knowledge
  drop constraint if exists tenant_knowledge_status_check;

alter table public.tenant_knowledge
  add constraint tenant_knowledge_status_check
  check (status in ('pending','processing','pending_review','completed','failed'));

alter table public.tenant_knowledge
  add column if not exists approved_at timestamptz,
  add column if not exists approval_expires_at timestamptz,
  add column if not exists approved_by uuid,
  add column if not exists approval_checksum text,
  add column if not exists approval_version integer not null default 0;

-- Preserve already-reviewed candidate data using its existing immutable audit
-- history. Sources with no approval event deliberately remain unapproved.
with latest_approval as (
  select distinct on (payload_json ->> 'source_id')
    (payload_json ->> 'source_id')::uuid as source_id,
    actor_user_id,
    created_at,
    nullif(payload_json ->> 'expires_at', '')::timestamptz as expires_at,
    nullif(payload_json ->> 'checksum', '') as checksum,
    coalesce((payload_json ->> 'version')::integer, 1) as version
  from public.audit_log
  where action = 'knowledge.source_approved'
    and payload_json ? 'source_id'
  order by payload_json ->> 'source_id', created_at desc
)
update public.tenant_knowledge k
set approved_at = a.created_at,
    approval_expires_at = a.expires_at,
    approved_by = a.actor_user_id,
    approval_checksum = a.checksum,
    approval_version = greatest(k.approval_version, a.version),
    status = case
      when a.expires_at is not null and a.expires_at <= now() then 'pending_review'
      else 'completed'
    end,
    updated_at = now()
from latest_approval a
where a.source_id = k.id;

-- Any processed source without an approval event is not runtime-active.
update public.tenant_knowledge
set status = 'pending_review',
    updated_at = now()
where status = 'completed'
  and approved_at is null;

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
set search_path to 'public'
as $function$
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

  next_version := source_row.approval_version + case when p_action = 'approved' then 1 else 0 end;

  if p_action = 'approved' then
    if source_row.status not in ('pending_review', 'completed') then
      raise exception 'Source must be processed before approval';
    end if;
    if source_row.content_text is null or length(trim(source_row.content_text)) = 0 then
      raise exception 'Source has no processed content';
    end if;
    if p_expires_at is not null and p_expires_at <= now() then
      raise exception 'Approval expiry must be in the future';
    end if;
    event_action := 'knowledge.source_approved';
    next_status := 'completed';

    update public.tenant_knowledge
    set status = next_status,
        approved_at = now(),
        approval_expires_at = p_expires_at,
        approved_by = auth.uid(),
        approval_checksum = nullif(trim(coalesce(p_checksum, '')), ''),
        approval_version = next_version,
        updated_at = now()
    where id = source_row.id;
  elsif p_action = 'revoked' then
    event_action := 'knowledge.source_revoked';
    next_status := 'pending_review';

    update public.tenant_knowledge
    set status = next_status,
        approved_at = null,
        approval_expires_at = null,
        approved_by = null,
        approval_checksum = null,
        updated_at = now()
    where id = source_row.id;
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

  return jsonb_build_object(
    'source_id', source_row.id,
    'status', next_status,
    'version', next_version,
    'action', event_action
  );
end;
$function$;

revoke execute on function public.set_knowledge_source_governance(uuid,text,timestamptz,text,text)
  from public, anon;
grant execute on function public.set_knowledge_source_governance(uuid,text,timestamptz,text,text)
  to authenticated;
