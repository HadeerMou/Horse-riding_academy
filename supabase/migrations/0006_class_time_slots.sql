-- A fixed, admin-managed list of time-of-day slots (e.g. the academy runs
-- 6-6:45, 7-7:45, 8-8:45, 9-9:45). Creating a group now means: pick a level,
-- pick however many weekdays it meets, and pick ONE slot from this list —
-- every day the group meets uses that same time. group_meeting_times still
-- stores its own start_time/end_time (copied from the slot at creation time)
-- so editing or removing a slot here never disturbs a group that already
-- used it.
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

-- Seed with the four slots the existing seeded groups already use.
insert into public.class_time_slots (start_time, end_time) values
  ('06:00', '06:45'),
  ('07:00', '07:45'),
  ('08:00', '08:45'),
  ('09:00', '09:45')
on conflict (start_time, end_time) do nothing;
