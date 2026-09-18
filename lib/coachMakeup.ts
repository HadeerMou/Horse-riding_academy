import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS } from "@/lib/coachSchedule";
import { formatGroupTime } from "@/lib/sessions";

// Local calendar date — toISOString() converts to UTC first, which rolls the
// date back a day in any timezone ahead of UTC.
function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type RiderInfo = { full_name: string | null; email: string } | null;
type MeetingTimesInfo = { group_meeting_times: { weekday: number; start_time: string; end_time: string }[] } | null;

function riderLabel(rider: RiderInfo): string {
  return rider ? rider.full_name || rider.email : "Unknown rider";
}

// A group can have several meeting times now, so the one relevant to a
// specific session is whichever falls on that date's weekday.
function groupLabel(group: MeetingTimesInfo, date: string): string | null {
  if (!group) return null;
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const meetingTime = group.group_meeting_times.find((m) => m.weekday === weekday);
  if (!meetingTime) return WEEKDAYS[weekday];
  return `${WEEKDAYS[weekday]} ${formatGroupTime(meetingTime.start_time)}–${formatGroupTime(meetingTime.end_time)}`;
}

export type ExcusedSessionRow = {
  id: string;
  enrollmentId: string;
  riderName: string;
  riderEmail: string;
  date: string;
  sessionType: "group" | "private";
  groupLabel: string | null;
};

// Riders who've marked an upcoming session "out" — for group sessions this
// already opened a spot automatically; private ones need the coach to
// schedule a replacement date.
export async function getUpcomingExcusedSessions(): Promise<ExcusedSessionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollment_sessions")
    .select(
      "id, enrollment_id, session_date, profiles(full_name, email), enrollments(session_type), lesson_groups(group_meeting_times(weekday, start_time, end_time))"
    )
    .eq("status", "excused")
    .gte("session_date", today())
    .order("session_date", { ascending: true });
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    const rider = row.profiles as unknown as RiderInfo;
    const enrollment = row.enrollments as unknown as { session_type: "group" | "private" } | null;
    if (!enrollment) return [];
    return [
      {
        id: row.id,
        enrollmentId: row.enrollment_id,
        riderName: riderLabel(rider),
        riderEmail: rider?.email ?? "",
        date: row.session_date,
        sessionType: enrollment.session_type,
        groupLabel: groupLabel(row.lesson_groups as unknown as MeetingTimesInfo, row.session_date),
      },
    ];
  });
}

export type MakeupBookingRow = {
  id: string;
  riderName: string;
  riderEmail: string;
  date: string;
  status: "scheduled" | "attended" | "missed";
  groupLabel: string | null;
};

// Riders who've claimed an open spot to make up a missed session elsewhere —
// they aren't regular members of this group, so they won't show up in the
// per-group attendance list and need to be tracked separately.
export async function getUpcomingMakeupBookings(): Promise<MakeupBookingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollment_sessions")
    .select("id, session_date, status, profiles(full_name, email), lesson_groups(group_meeting_times(weekday, start_time, end_time))")
    .not("makeup_of_session_id", "is", null)
    .gte("session_date", today())
    .order("session_date", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const rider = row.profiles as unknown as RiderInfo;
    return {
      id: row.id,
      riderName: riderLabel(rider),
      riderEmail: rider?.email ?? "",
      date: row.session_date,
      status: row.status as MakeupBookingRow["status"],
      groupLabel: groupLabel(row.lesson_groups as unknown as MeetingTimesInfo, row.session_date),
    };
  });
}

export type CapacityOverrideRow = {
  id: string;
  groupId: string;
  date: string;
  extraSpots: number;
  groupLabel: string | null;
};

export async function getUpcomingCapacityOverrides(): Promise<CapacityOverrideRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_capacity_overrides")
    .select("id, group_id, session_date, extra_spots, lesson_groups(group_meeting_times(weekday, start_time, end_time))")
    .gte("session_date", today())
    .order("session_date", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    groupId: row.group_id,
    date: row.session_date,
    extraSpots: row.extra_spots,
    groupLabel: groupLabel(row.lesson_groups as unknown as MeetingTimesInfo, row.session_date),
  }));
}
