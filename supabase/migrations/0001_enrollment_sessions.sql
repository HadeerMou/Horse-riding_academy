-- Adds per-lesson scheduling and attendance tracking for paid enrollments.
-- Run once in an existing project's SQL Editor. New projects get this from
-- schema.sql directly and should skip this file.

create table public.enrollment_sessions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  rider_id uuid not null references public.profiles(id) on delete cascade,
  session_date date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'attended', 'missed')),
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
