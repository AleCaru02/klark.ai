-- RLS does not protect TRUNCATE. Remove every inherited table privilege and
-- grant back only the exact operations needed by authenticated tenant users.
revoke all privileges on public.site_chatbots from authenticated;
revoke all privileges on public.site_chat_sessions from authenticated;
revoke all privileges on public.site_chat_messages from authenticated;
revoke all privileges on public.usage_site_chat_daily from authenticated;

revoke all privileges on public.site_chatbots from anon;
revoke all privileges on public.site_chat_sessions from anon;
revoke all privileges on public.site_chat_messages from anon;
revoke all privileges on public.usage_site_chat_daily from anon;

grant select, insert, update, delete on public.site_chatbots to authenticated;
grant select on public.site_chat_sessions to authenticated;
grant select on public.site_chat_messages to authenticated;
grant select on public.usage_site_chat_daily to authenticated;
