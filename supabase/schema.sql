-- Nocturne Riding Academy — full schema
-- Run this once in your Supabase project's SQL editor (Dashboard → SQL Editor
-- → New query). It's idempotent-ish for a fresh project; on an existing
-- project, run the numbered migrations in supabase/migrations/ instead.

-- =============================================================================
-- 1. Profiles — one row per auth user, mirroring basic info from auth.users so
--    app tables can reference/embed it via PostgREST (auth.users itself isn't
--    queryable from the API). riding_level starts null; a coach sets it after
--    the rider's trial session.
-- =============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  riding_level text check (riding_level in ('foundation', 'progression', 'performance', 'elite')),
  -- Single source of truth for "is this account a coach" — flip this on for
  -- your own account after it's created: `update profiles set is_coach = true
  -- where email = 'you@example.com'`. Every other coach-detection check
  -- (is_coach(), notify_coaches()) reads this one column, so there's exactly
  -- one place to manage who's a coach.
  is_coach boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_coach from public.profiles where id = auth.uid()), false);
$$;

revoke execute on function public.is_coach() from public, anon;
grant execute on function public.is_coach() to authenticated;

create policy "profiles_select_own_or_coach" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_coach());

create policy "profiles_update_coach" on public.profiles
  for update to authenticated using (public.is_coach()) with check (public.is_coach());

-- Keep profiles in sync with new signups.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for accounts that registered before this table existed.
insert into public.profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name')
from auth.users
on conflict (id) do nothing;

-- =============================================================================
-- 2. Trial sessions — a fixed weekly recurring schedule riders book into.
-- =============================================================================
create table public.trial_slots (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  capacity smallint not null default 4 check (capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.trial_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.trial_slots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_date date not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (slot_id, session_date, user_id)
);

create index trial_bookings_slot_date_idx on public.trial_bookings (slot_id, session_date) where status = 'confirmed';
create index trial_bookings_user_idx on public.trial_bookings (user_id);

alter table public.trial_slots enable row level security;
alter table public.trial_bookings enable row level security;

-- Riders see active slots to book; coaches see (and manage) everything,
-- including deactivated slots.
create policy "trial_slots_select_authenticated" on public.trial_slots
  for select to authenticated using (active = true);
create policy "trial_slots_select_coach_all" on public.trial_slots
  for select to authenticated using (public.is_coach());
create policy "trial_slots_insert_coach" on public.trial_slots
  for insert to authenticated with check (public.is_coach());
create policy "trial_slots_update_coach" on public.trial_slots
  for update to authenticated using (public.is_coach()) with check (public.is_coach());

create policy "trial_bookings_select_own" on public.trial_bookings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "trial_bookings_select_coach" on public.trial_bookings
  for select to authenticated using (public.is_coach());
create policy "trial_bookings_insert_own" on public.trial_bookings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "trial_bookings_update_own" on public.trial_bookings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "trial_bookings_update_coach" on public.trial_bookings
  for update to authenticated using (public.is_coach()) with check (public.is_coach());

-- Starter weekly schedule: Tue/Thu evenings, Sat morning. Edit/add slots from
-- the coach dashboard (/coach/schedule) after setup.
insert into public.trial_slots (weekday, start_time, end_time, capacity) values
  (2, '17:00', '18:00', 4), -- Tuesday 5-6pm
  (4, '17:00', '18:00', 4), -- Thursday 5-6pm
  (6, '10:00', '11:00', 4); -- Saturday 10-11am

-- =============================================================================
-- 3. Plans & enrollments — what a rider enrolls in once their level is set.
--    Payment is cash-only for now: enrollments start "pending" and a coach
--    flips them to "paid" once the rider actually pays in person.
-- =============================================================================
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('foundation', 'progression', 'performance', 'elite')),
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  session_count smallint not null check (session_count > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;

-- Anyone (including signed-out homepage visitors) can see active plans;
-- coaches can also see deactivated ones to manage them.
create policy "plans_select_active_or_coach" on public.plans
  for select to anon, authenticated using (active = true or public.is_coach());
create policy "plans_insert_coach" on public.plans
  for insert to authenticated with check (public.is_coach());
create policy "plans_update_coach" on public.plans
  for update to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "plans_delete_coach" on public.plans
  for delete to authenticated using (public.is_coach());

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  payment_method text not null default 'cash' check (payment_method in ('cash')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index enrollments_rider_idx on public.enrollments (rider_id);

alter table public.enrollments enable row level security;

create policy "enrollments_select_own_or_coach" on public.enrollments
  for select to authenticated using (rider_id = (select auth.uid()) or public.is_coach());
create policy "enrollments_insert_own" on public.enrollments
  for insert to authenticated with check (rider_id = (select auth.uid()));
create policy "enrollments_update_coach" on public.enrollments
  for update to authenticated using (public.is_coach()) with check (public.is_coach());

-- Starter plans matching the homepage's marketing copy — edit prices,
-- session counts, and descriptions from /coach/plans after setup. A plan's
-- description is a list of "what's included" bullets separated by `;`.
insert into public.plans (level, name, description, price, session_count) values
  ('foundation', 'Foundation Monthly', 'Groundwork & balance; Small group, indoor arena', 120.00, 4),
  ('progression', 'Progression Monthly', 'Trot, canter & pole work; Small group or semi-private', 220.00, 8),
  ('performance', 'Performance Monthly', 'Jumping & dressage technique; Private & semi-private', 340.00, 12),
  ('elite', 'Elite Monthly', 'Competition & circuit prep; Dedicated coach partnership', 600.00, 12);

-- =============================================================================
-- 4. Enrollment sessions — the coach schedules individual lesson dates for a
--    paid enrollment (up to the plan's session_count) and marks each one
--    attended or missed after it happens. Riders see this as their schedule.
--    rider_id is duplicated from enrollments here (rather than joined) purely
--    to keep the RLS policies below simple.
-- =============================================================================
create table public.enrollment_sessions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  rider_id uuid not null references public.profiles(id) on delete cascade,
  session_date date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'attended', 'missed', 'excused')),
  -- Set when this row is a makeup booking, pointing back at the missed/excused
  -- session it resolves. Null for an ordinary session.
  makeup_of_session_id uuid references public.enrollment_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (enrollment_id, session_date)
);

create index enrollment_sessions_rider_idx on public.enrollment_sessions (rider_id);
create index enrollment_sessions_enrollment_idx on public.enrollment_sessions (enrollment_id);

alter table public.enrollment_sessions enable row level security;

create policy "enrollment_sessions_select_own_or_coach" on public.enrollment_sessions
  for select to authenticated using (rider_id = (select auth.uid()) or public.is_coach());
create policy "enrollment_sessions_insert_coach" on public.enrollment_sessions
  for insert to authenticated with check (public.is_coach());
create policy "enrollment_sessions_update_coach" on public.enrollment_sessions
  for update to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "enrollment_sessions_delete_coach" on public.enrollment_sessions
  for delete to authenticated using (public.is_coach());

-- A rider can only insert a brand-new row of her own to book a makeup
-- session against one of her own unresolved misses (status 'scheduled' with
-- makeup_of_session_id set) — an ordinary group class row is already
-- pre-scheduled by ensure_group_sessions_for_month() (section 8), so marking
-- one "out" is an update, not an insert (see enrollment_sessions_update_own_excuse below).
create policy "enrollment_sessions_insert_own_makeup" on public.enrollment_sessions
  for insert to authenticated with check (
    rider_id = (select auth.uid())
    and exists (select 1 from public.enrollments e where e.id = enrollment_id and e.rider_id = (select auth.uid()))
    and status = 'scheduled'
    and makeup_of_session_id is not null
  );

-- Riders can excuse themselves from an already-scheduled session (group or
-- private) as long as it's still upcoming.
create policy "enrollment_sessions_update_own_excuse" on public.enrollment_sessions
  for update to authenticated using (
    rider_id = (select auth.uid()) and status = 'scheduled' and session_date >= current_date
  ) with check (
    rider_id = (select auth.uid()) and status = 'excused'
  );

-- ...and can undo that back to attending, as long as it's still upcoming.
-- The server action layer checks that this won't overbook the class (someone
-- may have already claimed the spot as a makeup) or double-resolve an
-- already-made-up miss — RLS here only enforces ownership, status
-- transition, and timing.
create policy "enrollment_sessions_update_own_uncancel" on public.enrollment_sessions
  for update to authenticated using (
    rider_id = (select auth.uid()) and status = 'excused' and session_date >= current_date
  ) with check (
    rider_id = (select auth.uid()) and status = 'scheduled'
  );

-- =============================================================================
-- 5. Group vs. private — a rider picks one when enrolling. "Group" attends a
--    recurring weekly class (section 7); "private" gets individual sessions
--    scheduled ad-hoc by the coach (section 4, above).
-- =============================================================================
alter table public.enrollments
  add column session_type text not null default 'group' check (session_type in ('group', 'private'));

-- =============================================================================
-- 6. Class time slots — a fixed, admin-managed list of time-of-day slots
--    (e.g. the academy runs 6-6:45, 7-7:45, 8-8:45, 9-9:45). Creating a group
--    means picking a level, picking however many weekdays it meets, and
--    picking ONE slot from this list — every day the group meets uses that
--    same time. group_meeting_times (below) stores its own start_time/
--    end_time copied from the slot at creation time, so editing or removing
--    a slot here never disturbs a group that already used it.
-- =============================================================================
create table public.class_time_slots (
  id uuid primary key default gen_random_uuid(),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  unique (start_time, end_time)
);

alter table public.class_time_slots enable row level security;

create policy "class_time_slots_select_authenticated" on public.class_time_slots
  for select to authenticated using (true);
create policy "class_time_slots_insert_coach" on public.class_time_slots
  for insert to authenticated with check (public.is_coach());
create policy "class_time_slots_delete_coach" on public.class_time_slots
  for delete to authenticated using (public.is_coach());

insert into public.class_time_slots (start_time, end_time) values
  ('06:00', '06:45'),
  ('07:00', '07:45'),
  ('08:00', '08:45'),
  ('09:00', '09:45');

-- =============================================================================
-- 7. Lesson groups — the recurring weekly classes group riders attend. A
--    group can meet on more than one fixed day a week (e.g. Progression
--    meets twice, Performance three times) — see group_meeting_times below.
--    A rider joins the GROUP once; ensure_group_sessions_for_month() (section
--    8) auto-schedules every one of its meeting times for the rest of the
--    month, so the coach never manually assigns individual dates. Fully
--    editable from /coach/groups — add, remove, retime, resize, or
--    deactivate any of them, or add more for a level that doesn't have any
--    yet (e.g. Elite).
-- =============================================================================
create table public.lesson_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text not null check (level in ('foundation', 'progression', 'performance', 'elite')),
  capacity smallint not null default 6 check (capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index lesson_groups_level_idx on public.lesson_groups (level);

alter table public.lesson_groups enable row level security;

create policy "lesson_groups_select_authenticated" on public.lesson_groups
  for select to authenticated using (active = true or public.is_coach());
create policy "lesson_groups_insert_coach" on public.lesson_groups
  for insert to authenticated with check (public.is_coach());
create policy "lesson_groups_update_coach" on public.lesson_groups
  for update to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "lesson_groups_delete_coach" on public.lesson_groups
  for delete to authenticated using (public.is_coach());

create table public.group_meeting_times (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.lesson_groups(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  unique (group_id, weekday, start_time)
);

create index group_meeting_times_group_idx on public.group_meeting_times (group_id);

alter table public.group_meeting_times enable row level security;

create policy "group_meeting_times_select_authenticated" on public.group_meeting_times
  for select to authenticated using (
    exists (select 1 from public.lesson_groups lg where lg.id = group_id and (lg.active = true or public.is_coach()))
  );
create policy "group_meeting_times_insert_coach" on public.group_meeting_times
  for insert to authenticated with check (public.is_coach());
create policy "group_meeting_times_delete_coach" on public.group_meeting_times
  for delete to authenticated using (public.is_coach());

-- Riders the coach has placed into a group — one row per rider per group,
-- covering every one of that group's meeting times at once.
-- group_id uses "on delete restrict" so a group with riders in it can't be
-- deleted out from under them — remove the members (or deactivate the group)
-- first.
create table public.lesson_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.lesson_groups(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  rider_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, rider_id)
);

create index lesson_group_members_group_idx on public.lesson_group_members (group_id);
create index lesson_group_members_rider_idx on public.lesson_group_members (rider_id);

alter table public.lesson_group_members enable row level security;

create policy "lesson_group_members_select_own_or_coach" on public.lesson_group_members
  for select to authenticated using (rider_id = (select auth.uid()) or public.is_coach());
create policy "lesson_group_members_insert_coach" on public.lesson_group_members
  for insert to authenticated with check (public.is_coach());
create policy "lesson_group_members_delete_coach" on public.lesson_group_members
  for delete to authenticated using (public.is_coach());

-- Ties an attendance row (section 4) back to the recurring group it was
-- taken for — null for private, ad-hoc sessions.
alter table public.enrollment_sessions
  add column group_id uuid references public.lesson_groups(id) on delete set null;

-- Seed groups: four time-of-day groups per level, each with as many weekly
-- meeting times as that level meets (placeholder weekdays below — edit
-- freely from /coach/groups). Elite has none seeded; add some there if it
-- should offer group classes too.
do $$
declare
  slot record;
  wd smallint;
  new_group_id uuid;
begin
  for slot in select * from (values
    ('6:00 AM', '06:00'::time, '06:45'::time),
    ('7:00 AM', '07:00'::time, '07:45'::time),
    ('8:00 AM', '08:00'::time, '08:45'::time),
    ('9:00 AM', '09:00'::time, '09:45'::time)
  ) as t(label, start_time, end_time)
  loop
    -- Foundation meets once a week (Tuesday).
    insert into public.lesson_groups (name, level, capacity)
      values ('Foundation ' || slot.label, 'foundation', 6) returning id into new_group_id;
    insert into public.group_meeting_times (group_id, weekday, start_time, end_time)
      values (new_group_id, 2, slot.start_time, slot.end_time);

    -- Progression meets twice a week (Tuesday + Thursday).
    insert into public.lesson_groups (name, level, capacity)
      values ('Progression ' || slot.label, 'progression', 6) returning id into new_group_id;
    foreach wd in array array[2, 4] loop
      insert into public.group_meeting_times (group_id, weekday, start_time, end_time)
        values (new_group_id, wd, slot.start_time, slot.end_time);
    end loop;

    -- Performance meets three times a week (Tuesday + Thursday + Saturday).
    insert into public.lesson_groups (name, level, capacity)
      values ('Performance ' || slot.label, 'performance', 6) returning id into new_group_id;
    foreach wd in array array[2, 4, 6] loop
      insert into public.group_meeting_times (group_id, weekday, start_time, end_time)
        values (new_group_id, wd, slot.start_time, slot.end_time);
    end loop;
  end loop;
end $$;

-- =============================================================================
-- 8. Makeup sessions — riders can mark a session "out" ahead of time (see the
--    self-service policies on enrollment_sessions above), which frees a spot
--    in that class for someone else to make up a session they missed. Coaches
--    can also open an extra spot on any date even with nobody out.
-- =============================================================================
create table public.group_capacity_overrides (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.lesson_groups(id) on delete cascade,
  session_date date not null,
  extra_spots smallint not null check (extra_spots > 0),
  created_at timestamptz not null default now(),
  unique (group_id, session_date)
);

create index group_capacity_overrides_group_idx on public.group_capacity_overrides (group_id);

alter table public.group_capacity_overrides enable row level security;

create policy "group_capacity_overrides_select_authenticated" on public.group_capacity_overrides
  for select to authenticated using (true);
create policy "group_capacity_overrides_insert_coach" on public.group_capacity_overrides
  for insert to authenticated with check (public.is_coach());
create policy "group_capacity_overrides_update_coach" on public.group_capacity_overrides
  for update to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "group_capacity_overrides_delete_coach" on public.group_capacity_overrides
  for delete to authenticated using (public.is_coach());

-- A rider can only see the raw attendance rows of other riders through this:
-- a security-definer function that returns computed availability (never
-- row-level attendance data) for every active group at a level, across a date
-- range. A date's available count = capacity - members + (members excused
-- that date) + (coach's extra spots that date) - (makeup bookings already
-- claimed that date).
create or replace function public.open_makeup_spots_for_level(p_level text, p_from date, p_to date)
returns table (group_id uuid, session_date date, weekday smallint, start_time time, end_time time, available int)
language sql
stable
security definer
set search_path = public
as $$
  with occurrences as (
    select gmt.group_id, gmt.weekday, gmt.start_time, gmt.end_time, lg.capacity, d.session_date
    from public.lesson_groups lg
    join public.group_meeting_times gmt on gmt.group_id = lg.id
    cross join lateral (
      select gs::date as session_date
      from generate_series(p_from, p_to, interval '1 day') gs
      where extract(dow from gs)::smallint = gmt.weekday
    ) d
    where lg.level = p_level and lg.active = true
  ),
  member_counts as (
    select group_id, count(*) as member_count from public.lesson_group_members group by group_id
  ),
  excused_counts as (
    select es.group_id, es.session_date, count(*) as excused_count
    from public.enrollment_sessions es
    join public.lesson_group_members m on m.group_id = es.group_id and m.rider_id = es.rider_id
    where es.status = 'excused' and es.group_id is not null
    group by es.group_id, es.session_date
  ),
  makeup_counts as (
    select group_id, session_date, count(*) as makeup_count
    from public.enrollment_sessions
    where makeup_of_session_id is not null and status in ('scheduled', 'attended') and group_id is not null
    group by group_id, session_date
  )
  select
    o.group_id, o.session_date, o.weekday, o.start_time, o.end_time,
    (o.capacity - coalesce(mc.member_count, 0) + coalesce(ec.excused_count, 0)
      + coalesce(gco.extra_spots, 0) - coalesce(uc.makeup_count, 0))::int as available
  from occurrences o
  left join member_counts mc on mc.group_id = o.group_id
  left join excused_counts ec on ec.group_id = o.group_id and ec.session_date = o.session_date
  left join public.group_capacity_overrides gco on gco.group_id = o.group_id and gco.session_date = o.session_date
  left join makeup_counts uc on uc.group_id = o.group_id and uc.session_date = o.session_date
  where (o.capacity - coalesce(mc.member_count, 0) + coalesce(ec.excused_count, 0)
      + coalesce(gco.extra_spots, 0) - coalesce(uc.makeup_count, 0)) > 0
$$;

revoke execute on function public.open_makeup_spots_for_level(text, date, date) from public, anon;
grant execute on function public.open_makeup_spots_for_level(text, date, date) to authenticated;

-- Auto-schedules every group member's fixed classes for the current month.
-- Safe to call from anywhere by anyone signed in (rider or coach): it only
-- ever adds missing 'scheduled' rows, so calling it repeatedly (e.g. on every
-- page load) is a no-op once the month is filled in. Runs as security
-- definer since a rider's own session isn't self-insertable under the normal
-- RLS policies below — this is system-generated scheduling, not rider
-- self-service.
create or replace function public.ensure_group_sessions_for_month()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.enrollment_sessions (enrollment_id, rider_id, group_id, session_date, status)
  select m.enrollment_id, m.rider_id, m.group_id, d.session_date, 'scheduled'
  from public.lesson_group_members m
  join public.lesson_groups lg on lg.id = m.group_id and lg.active = true
  join public.group_meeting_times gmt on gmt.group_id = m.group_id
  cross join lateral (
    select gs::date as session_date
    from generate_series(
      date_trunc('month', current_date)::date,
      (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
      interval '1 day'
    ) gs
    where extract(dow from gs)::smallint = gmt.weekday
      and gs::date >= m.created_at::date
  ) d
  on conflict (enrollment_id, session_date) do nothing;
end;
$$;

revoke execute on function public.ensure_group_sessions_for_month() from public, anon;
grant execute on function public.ensure_group_sessions_for_month() to authenticated;

-- =============================================================================
-- 9. Notifications — the coach and a rider each see their own feed of what
--    just happened on the other side (a rider marking out or booking a
--    makeup spot notifies the coach; the coach setting a level, placing
--    someone in a group, taking payment, or scheduling/cancelling a session
--    notifies that rider).
-- =============================================================================
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

-- Fans a notification out to every coach account — reads the same
-- profiles.is_coach flag as is_coach() (section 1, above).
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

revoke execute on function public.notify_coaches(text, text, text) from public, anon;
grant execute on function public.notify_coaches(text, text, text) to authenticated;

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
