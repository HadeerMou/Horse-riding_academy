import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS } from "@/lib/coachSchedule";
import type { RidingLevel } from "@/lib/coach";

// Local calendar date, not UTC — date.toISOString() converts to UTC first,
// which rolls the date back a day in any timezone ahead of UTC and would
// desync the string from the weekday it was generated for.
function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// The last calendar day of the month `date` falls in.
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// Auto-schedules every group member's fixed classes for the current month
// (idempotent — only ever adds missing rows). Call this at the top of any
// page that reads group sessions, so a new month or a just-added meeting
// time is always reflected without a separate background job.
export async function ensureCurrentMonthSessions(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ensure_group_sessions_for_month");
  if (error) throw error;
}

export type UnresolvedMissedSession = {
  id: string;
  date: string;
  weekdayLabel: string;
};

// A rider's own missed/excused group sessions that no makeup booking has
// resolved yet — these are what an open spot elsewhere can be used against.
export async function getUnresolvedMissedGroupSessions(enrollmentId: string): Promise<UnresolvedMissedSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollment_sessions")
    .select("id, session_date")
    .eq("enrollment_id", enrollmentId)
    .in("status", ["missed", "excused"])
    .not("group_id", "is", null)
    .order("session_date", { ascending: true });
  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: resolved, error: resolvedError } = await supabase
    .from("enrollment_sessions")
    .select("makeup_of_session_id")
    .in(
      "makeup_of_session_id",
      rows.map((r) => r.id)
    );
  if (resolvedError) throw resolvedError;
  const resolvedIds = new Set((resolved ?? []).map((r) => r.makeup_of_session_id));

  return rows
    .filter((r) => !resolvedIds.has(r.id))
    .map((r) => ({
      id: r.id,
      date: r.session_date,
      weekdayLabel: WEEKDAYS[new Date(`${r.session_date}T00:00:00`).getDay()],
    }));
}

export type OpenMakeupSpot = {
  groupId: string;
  date: string;
  weekdayLabel: string;
  startTime: string;
  endTime: string;
  available: number;
};

// Computed availability only — never exposes another rider's attendance row,
// see the open_makeup_spots_for_level() security-definer function. Bounded to
// the rest of the current month — a session missed this month has to be made
// up this month, not carried into the next.
export async function getOpenMakeupSpotsForLevel(level: RidingLevel): Promise<OpenMakeupSpot[]> {
  const supabase = await createClient();
  const now = new Date();
  const from = toDateString(now);
  const to = toDateString(endOfMonth(now));

  const { data, error } = await supabase.rpc("open_makeup_spots_for_level", {
    p_level: level,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;

  return ((data ?? []) as {
    group_id: string;
    session_date: string;
    weekday: number;
    start_time: string;
    end_time: string;
    available: number;
  }[])
    .map((row) => ({
      groupId: row.group_id,
      date: row.session_date,
      weekdayLabel: WEEKDAYS[row.weekday],
      startTime: row.start_time,
      endTime: row.end_time,
      available: row.available,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
