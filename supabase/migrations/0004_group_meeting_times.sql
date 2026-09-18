-- A group can meet on more than one fixed day each week (e.g. "Progression A:
-- Tue 6-6:45 AND Thu 6-6:45"). Previously each weekday needed its own
-- lesson_groups row and the coach had to add a rider to each one separately.
-- Now a group holds a list of meeting times, a rider joins the group once,
-- and ensure_group_sessions_for_month() auto-schedules every one of those
-- meeting times for the rest of the current month — no manual per-date
-- assignment.

-- =============================================================================
-- 1. group_meeting_times
-- =============================================================================
create table public.group_meeting_times (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.lesson_groups(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
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

-- Preserve every existing group's schedule as its first meeting time before
-- dropping the old single weekday/start_time/end_time columns.
insert into public.group_meeting_times (group_id, weekday, start_time, end_time)
select id, weekday, start_time, end_time from public.lesson_groups;

alter table public.lesson_groups drop column weekday;
alter table public.lesson_groups drop column start_time;
alter table public.lesson_groups drop column end_time;

-- =============================================================================
-- 2. open_makeup_spots_for_level now sources occurrences from every meeting
--    time of a group instead of one weekday/start/end pair.
-- =============================================================================
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

-- =============================================================================
-- 3. ensure_group_sessions_for_month — auto-schedules every group member's
--    fixed classes for the current month. Safe to call from anywhere by
--    anyone signed in (rider or coach): it only ever adds missing 'scheduled'
--    rows, so calling it repeatedly (e.g. on every page load) is a no-op once
--    the month is filled in. Runs as security definer since a rider's own
--    session isn't self-insertable under the normal RLS policies — this is
--    system-generated scheduling, not rider self-service.
-- =============================================================================
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
-- 4. Riders now update an already-scheduled group session to 'excused'
--    (generated ahead of time by ensure_group_sessions_for_month) rather than
--    inserting a fresh excused row, so the group branch of the old insert
--    policy is no longer needed — only a makeup booking still needs to insert
--    a brand-new row (the rider isn't a member of that class).
-- =============================================================================
drop policy "enrollment_sessions_insert_own_self_service" on public.enrollment_sessions;

create policy "enrollment_sessions_insert_own_makeup" on public.enrollment_sessions
  for insert to authenticated with check (
    rider_id = (select auth.uid())
    and exists (select 1 from public.enrollments e where e.id = enrollment_id and e.rider_id = (select auth.uid()))
    and status = 'scheduled'
    and makeup_of_session_id is not null
  );
