-- Lets the browser subscribe to a user's own notifications live (Postgres
-- Changes over Realtime) instead of only seeing the unread count as of the
-- last page load. RLS still applies to realtime subscriptions, so this only
-- ever streams a user's own rows regardless of what filter the client asks
-- for.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
