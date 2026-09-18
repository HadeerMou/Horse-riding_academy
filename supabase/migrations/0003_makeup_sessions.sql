-- Makeup sessions — riders can mark a session "out" ahead of time (freeing a
-- spot in that class for someone else), and use an open spot elsewhere to
-- make up a session they missed or excused themselves from. Coaches can also
-- open an extra spot on any date even with nobody out.

-- =============================================================================
-- 1. enrollment_sessions: add 'excused' status (rider self-reported ahead of
--    time, distinct from 'missed' which the coach records after the fact),
--    and a link from a makeup booking back to the session it resolves.
-- =============================================================================
alter table public.enrollment_sessions drop constraint enrollment_sessions_status_check;
alter table public.enrollment_sessions
  add constraint enrollment_sessions_status_check check (status in ('scheduled', 'attended', 'missed', 'excused'));

alter table public.enrollment_sessions
  add column makeup_of_session_id uuid references public.enrollment_sessions(id) on delete set null;

-- Riders can mark themselves out: insert a fresh 'excused' row for a group
-- class date that hasn't happened yet (group rows only exist once someone
-- acts on them), or book a makeup session against one of their own unresolved
-- misses (status 'scheduled' with makeup_of_session_id set).
create policy "enrollment_sessions_insert_own_self_service" on public.enrollment_sessions
  for insert to authenticated with check (
    rider_id = (select auth.uid())
    and exists (select 1 from public.enrollments e where e.id = enrollment_id and e.rider_id = (select auth.uid()))
    and (
      (status = 'excused' and session_date >= current_date)
      or (status = 'scheduled' and makeup_of_session_id is not null)
    )
  );

-- Riders can excuse themselves from a private session the coach already
-- scheduled, as long as it's still upcoming.
create policy "enrollment_sessions_update_own_excuse" on public.enrollment_sessions
  for update to authenticated using (
    rider_id = (select auth.uid()) and status = 'scheduled' and session_date >= current_date
  ) with check (
    rider_id = (select auth.uid()) and status = 'excused'
  );

-- =============================================================================
-- 2. group_capacity_overrides — lets a coach open extra spot(s) on a specific
--    class date even when nobody has cancelled (e.g. inviting a rider who
--    missed a session elsewhere to sit in on this one).
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

-- =============================================================================
-- 3. open_makeup_spots_for_level — a rider can only see the raw attendance
--    rows of other riders through this: a security-definer function that
--    returns computed availability (never row-level attendance data) for
--    every active group at a level, across a date range. A date's available
--    count = capacity - members + (members excused that date) + (coach's
--    extra spots that date) - (makeup bookings already claimed that date).
-- =============================================================================
create or replace function public.open_makeup_spots_for_level(p_level text, p_from date, p_to date)
returns table (group_id uuid, session_date date, weekday smallint, start_time time, end_time time, available int)
language sql
stable
security definer
set search_path = public
as $$
  with occurrences as (
    select lg.id as group_id, lg.weekday, lg.start_time, lg.end_time, lg.capacity, d.session_date
    from public.lesson_groups lg
    cross join lateral (
      select gs::date as session_date
      from generate_series(p_from, p_to, interval '1 day') gs
      where extract(dow from gs)::smallint = lg.weekday
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
