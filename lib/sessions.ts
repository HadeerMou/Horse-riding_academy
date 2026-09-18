import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS } from "@/lib/coachSchedule";

export type SessionStatus = "scheduled" | "attended" | "missed" | "excused";

export type MeetingTime = {
  weekday: number;
  weekdayLabel: string;
  startTime: string;
  endTime: string;
};

export type MyGroupRow = {
  groupId: string;
  meetingTimes: MeetingTime[];
};

export async function getMyGroups(enrollmentId: string): Promise<MyGroupRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lesson_group_members")
    .select("lesson_groups(id, group_meeting_times(weekday, start_time, end_time))")
    .eq("enrollment_id", enrollmentId);
  if (error) throw error;

  return ((data ?? []) as unknown as {
    lesson_groups: { id: string; group_meeting_times: { weekday: number; start_time: string; end_time: string }[] } | null;
  }[]).flatMap((row) => {
    if (!row.lesson_groups) return [];
    const meetingTimes = row.lesson_groups.group_meeting_times
      .map((m) => ({
        weekday: m.weekday,
        weekdayLabel: WEEKDAYS[m.weekday],
        startTime: m.start_time,
        endTime: m.end_time,
      }))
      .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
    return [{ groupId: row.lesson_groups.id, meetingTimes }];
  });
}

export type EnrollmentSessionRow = {
  id: string;
  date: string; // yyyy-mm-dd
  status: SessionStatus;
  isMakeup: boolean;
  // Which class this session is for — a rider can belong to more than one
  // group, so a bare date alone doesn't say which one. Null for private.
  groupLabel: string | null;
};

export async function getSessionsForEnrollment(enrollmentId: string): Promise<EnrollmentSessionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollment_sessions")
    .select(
      "id, session_date, status, makeup_of_session_id, lesson_groups(name, group_meeting_times(weekday, start_time, end_time))"
    )
    .eq("enrollment_id", enrollmentId)
    .order("session_date", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const group = row.lesson_groups as unknown as {
      name: string;
      group_meeting_times: { weekday: number; start_time: string; end_time: string }[];
    } | null;

    let groupLabel: string | null = null;
    if (group) {
      const weekday = new Date(`${row.session_date}T00:00:00`).getDay();
      const meetingTime = group.group_meeting_times.find((m) => m.weekday === weekday);
      groupLabel = meetingTime
        ? `${group.name} — ${formatGroupTime(meetingTime.start_time)}–${formatGroupTime(meetingTime.end_time)}`
        : group.name;
    }

    return {
      id: row.id,
      date: row.session_date,
      status: row.status as SessionStatus,
      isMakeup: row.makeup_of_session_id !== null,
      groupLabel,
    };
  });
}

export function formatGroupTime(time: string): string {
  const [hoursStr, minutes] = time.split(":");
  const hours = Number(hoursStr);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutes} ${period}`;
}

export function formatSessionDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function sessionStatusLabel(status: SessionStatus, date: string): string {
  if (status === "attended") return "Attended";
  if (status === "missed") return "Missed";
  if (status === "excused") return "Marked out";
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return date >= today ? "Upcoming" : "Awaiting update";
}
