-- Adds group-vs-private enrollment, the recurring weekly lesson-group
-- schedule, and group membership/attendance linkage. Run once in an existing
-- project's SQL Editor. New projects get this from schema.sql directly and
-- should skip this file.

alter table public.enrollments
  add column session_type text not null default 'group' check (session_type in ('group', 'private'));

create table public.lesson_groups (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('foundation', 'progression', 'performance', 'elite')),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
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

alter table public.enrollment_sessions
  add column group_id uuid references public.lesson_groups(id) on delete set null;

-- Seed groups: the four time-of-day slots, repeated across however many
-- weekdays each level meets (placeholder weekdays below — edit freely from
-- /coach/groups). Elite has none seeded; add some there if it should offer
-- group classes too.
insert into public.lesson_groups (level, weekday, start_time, end_time) values
  ('foundation', 2, '06:00', '06:45'), ('foundation', 2, '07:00', '07:45'),
  ('foundation', 2, '08:00', '08:45'), ('foundation', 2, '09:00', '09:45'),
  ('progression', 2, '06:00', '06:45'), ('progression', 2, '07:00', '07:45'),
  ('progression', 2, '08:00', '08:45'), ('progression', 2, '09:00', '09:45'),
  ('progression', 4, '06:00', '06:45'), ('progression', 4, '07:00', '07:45'),
  ('progression', 4, '08:00', '08:45'), ('progression', 4, '09:00', '09:45'),
  ('performance', 2, '06:00', '06:45'), ('performance', 2, '07:00', '07:45'),
  ('performance', 2, '08:00', '08:45'), ('performance', 2, '09:00', '09:45'),
  ('performance', 4, '06:00', '06:45'), ('performance', 4, '07:00', '07:45'),
  ('performance', 4, '08:00', '08:45'), ('performance', 4, '09:00', '09:45'),
  ('performance', 6, '06:00', '06:45'), ('performance', 6, '07:00', '07:45'),
  ('performance', 6, '08:00', '08:45'), ('performance', 6, '09:00', '09:45');
