create or replace function public.bump_site_chat_usage_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'assistant' then
    perform public.record_site_chat_usage(
      new.tenant_id,
      greatest(coalesce(new.input_tokens, 0), 0),
      greatest(coalesce(new.output_tokens, 0), 0),
      0
    );
  end if;
  return new;
end;
$$;

revoke all on function public.bump_site_chat_usage_from_message() from public, anon, authenticated;

drop trigger if exists meter_site_chat_response on public.site_chat_messages;
create trigger meter_site_chat_response
after insert on public.site_chat_messages
for each row execute function public.bump_site_chat_usage_from_message();
