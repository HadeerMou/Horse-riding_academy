import { createClient } from "@/lib/supabase/server";
import type { RidingLevel } from "@/lib/coach";
import { WEEKDAYS } from "@/lib/coachSchedule";
import type { SessionStatus } from "@/lib/sessions";

export type MeetingTimeRow = {
  id: string;
  weekday: number;
  weekdayLabel: string;
  startTime: string;
  endTime: string;
};

export type LessonGroupMemberRow = {
  membershipId: string;
  enrollmentId: string;
  riderId: string;
  riderName: string;
  riderEmail: string;
};

export type LessonGroupRow = {
  id: string;
  name: string;
  level: RidingLevel;
  capacity: number;
  active: boolean;
  meetingTimes: MeetingTimeRow[];
  members: LessonGroupMemberRow[];
};

const GROUP_SELECT =
  "id, name, level, capacity, active, group_meeting_times(id, weekday, start_time, end_time), lesson_group_members(id, enrollment_id, rider_id, profiles(full_name, email))";

type RawGroupRow = {
  id: string;
  name: string;
  level: string;
  capacity: number;
  active: boolean;
  group_meeting_times: { id: string; weekday: number; start_time: string; end_time: string }[] | null;
  lesson_group_members:
    | { id: string; enrollment_id: string; rider_id: string; profiles: { full_name: string | null; email: string } | null }[]
    | null;
};

function mapGroupRow(row: RawGroupRow): LessonGroupRow {
  const meetingTimes = (row.group_meeting_times ?? [])
    .map((m) => ({
      id: m.id,
      weekday: m.weekday,
      weekdayLabel: WEEKDAYS[m.weekday],
      startTime: m.start_time,
      endTime: m.end_time,
    }))
    .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));

  const members = (row.lesson_group_members ?? []).flatMap((m) =>
    m.profiles
      ? [
          {
            membershipId: m.id,
            enrollmentId: m.enrollment_id,
            riderId: m.rider_id,
            riderName: m.profiles.full_name || m.profiles.email,
            riderEmail: m.profiles.email,
          },
        ]
      : []
  );

  return {
    id: row.id,
    name: row.name,
    level: row.level as RidingLevel,
    capacity: row.capacity,
    active: row.active,
    meetingTimes,
    members,
  };
}

export async function getAllLessonGroups(): Promise<LessonGroupRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lesson_groups").select(GROUP_SELECT).order("level", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as RawGroupRow[]).map(mapGroupRow);
}

export async function getLessonGroup(groupId: string): Promise<LessonGroupRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lesson_groups").select(GROUP_SELECT).eq("id", groupId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapGroupRow(data as unknown as RawGroupRow);
}

export type GroupSessionRider = {
  sessionId: string;
  riderName: string;
  riderEmail: string;
  status: SessionStatus;
  isMakeup: boolean;
};

export type GroupSessionDate = {
  date: string;
  riders: GroupSessionRider[];
};

// Every generated session for this group (see ensure_group_sessions_for_month),
// grouped by date — the actual roster and attendance for each class, past and
// upcoming, rather than just the fixed weekly template.
export async function getGroupSessions(groupId: string): Promise<GroupSessionDate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollment_sessions")
    .select("id, session_date, status, makeup_of_session_id, profiles(full_name, email)")
    .eq("group_id", groupId)
    .order("session_date", { ascending: true });
  if (error) throw error;

  const byDate = new Map<string, GroupSessionRider[]>();
  for (const row of (data ?? []) as unknown as {
    id: string;
    session_date: string;
    status: string;
    makeup_of_session_id: string | null;
    profiles: { full_name: string | null; email: string } | null;
  }[]) {
    const rider = row.profiles;
    const list = byDate.get(row.session_date) ?? [];
    list.push({
      sessionId: row.id,
      riderName: rider ? rider.full_name || rider.email : "Unknown rider",
      riderEmail: rider?.email ?? "",
      status: row.status as SessionStatus,
      isMakeup: row.makeup_of_session_id !== null,
    });
    byDate.set(row.session_date, list);
  }

  return [...byDate.entries()]
    .map(([date, riders]) => ({ date, riders: riders.sort((a, b) => a.riderName.localeCompare(b.riderName)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type EligibleRiderRow = {
  enrollmentId: string;
  riderId: string;
  riderName: string;
  riderEmail: string;
};

// Riders paid, on the group plan, at this level — candidates to add to one of
// its groups.
export async function getEligibleRidersForLevel(level: RidingLevel): Promise<EligibleRiderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, rider_id, session_type, status, profiles(full_name, email), plans(level)")
    .eq("session_type", "group")
    .eq("status", "paid");
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    const rider = row.profiles as unknown as { full_name: string | null; email: string } | null;
    const plan = row.plans as unknown as { level: RidingLevel } | null;
    if (!rider || !plan || plan.level !== level) return [];
    return [
      {
        enrollmentId: row.id,
        riderId: row.rider_id,
        riderName: rider.full_name || rider.email,
        riderEmail: rider.email,
      },
    ];
  });
}
