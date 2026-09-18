-- Bug fix: notify_coaches() (0007) hardcoded its own copy of the coach email
-- list ('coach@example.com'), separate from is_coach()'s copy — but the setup
-- docs have you edit the email directly inside is_coach(), so on any project
-- that followed them, notify_coaches() was matching zero accounts and
-- silently sending nothing. Fixing this for good by replacing both
-- hardcoded lists with one shared source of truth: an is_coach flag on
-- profiles.

alter table public.profiles add column is_coach boolean not null default false;

-- Backfill: pull whatever email(s) are actually inside the *current*
-- is_coach() definition (i.e. whatever you already customized it to) and
-- flag those accounts, so this migration doesn't undo your setup.
do $$
declare
  def text;
  emails text[];
begin
  select pg_get_functiondef('public.is_coach()'::regprocedure) into def;
  select array_agg(m[1]) into emails from regexp_matches(def, '''([^'']+)''', 'g') as m;
  if emails is not null then
    update public.profiles set is_coach = true where email = any(emails);
  end if;
end $$;

-- Both functions now read the same column — add a coach the same way from
-- now on: `update profiles set is_coach = true where email = '...'`.
create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_coach from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.notify_coaches(p_title text, p_body text default null, p_url text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, url)
  select id, p_title, p_body, p_url from public.profiles where is_coach = true;
end;
$$;
