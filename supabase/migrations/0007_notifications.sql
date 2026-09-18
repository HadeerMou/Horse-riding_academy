-- In-app notifications — the coach and a rider each see their own feed of
-- what just happened on the other side (a rider marking out or booking a
-- makeup spot notifies the coach; the coach setting a level, placing someone
-- in a group, taking payment, or scheduling/cancelling a session notifies
-- that rider).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  url text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications_update_own" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Notifications are always system-generated on someone else's behalf (a
-- rider's action notifies the coach, or vice versa) — never a direct user
-- insert of their own row — so both helpers below run as security definer.
create or replace function public.create_notification(p_user_id uuid, p_title text, p_body text default null, p_url text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, url) values (p_user_id, p_title, p_body, p_url);
end;
$$;

revoke execute on function public.create_notification(uuid, text, text, text) from public, anon;
grant execute on function public.create_notification(uuid, text, text, text) to authenticated;

-- Fans a notification out to every coach account. Keep this email list in
-- sync with is_coach() at the top of this schema.
create or replace function public.notify_coaches(p_title text, p_body text default null, p_url text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, url)
  select id, p_title, p_body, p_url from public.profiles where email in ('coach@example.com');
end;
$$;

revoke execute on function public.notify_coaches(text, text, text) from public, anon;
grant execute on function public.notify_coaches(text, text, text) to authenticated;
