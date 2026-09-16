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
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Single source of truth for "is this signed-in user a coach" — an email
-- allowlist for now; replace with your own coach email(s) below, and add
-- more as more coaches join.
create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select email from public.profiles where id = auth.uid()) in ('coach@example.com'),
    false
  );
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
