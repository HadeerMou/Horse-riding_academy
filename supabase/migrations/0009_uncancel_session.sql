-- Riders can undo "marked out" back to attending, as long as it's still
-- upcoming. The server action layer is responsible for checking that doing
-- so won't overbook the class (someone may have already claimed the spot as
-- a makeup) or double-resolve an already-made-up miss — RLS here only
-- enforces ownership, status transition, and timing.
create policy "enrollment_sessions_update_own_uncancel" on public.enrollment_sessions
  for update to authenticated using (
    rider_id = (select auth.uid()) and status = 'excused' and session_date >= current_date
  ) with check (
    rider_id = (select auth.uid()) and status = 'scheduled'
  );
