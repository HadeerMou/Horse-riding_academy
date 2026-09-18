import { createClient } from "@/lib/supabase/server";
import type { SessionStatus } from "@/lib/sessions";

export type CoachEnrollmentSessionsRow = {
  enrollmentId: string;
  riderName: string;
  riderEmail: string;
  planName: string;
  sessionCount: number;
  sessions: { id: string; date: string; status: SessionStatus }[];
};

export async function getPaidEnrollmentsWithSessions(): Promise<CoachEnrollmentSessionsRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      "id, profiles(full_name, email), plans(name, session_count), enrollment_sessions(id, session_date, status)"
    )
    .eq("status", "paid")
    .eq("session_type", "private")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    const rider = row.profiles as unknown as { full_name: string | null; email: string } | null;
    const plan = row.plans as unknown as { name: string; session_count: number } | null;
    if (!rider || !plan) return [];

    const sessions = ((row.enrollment_sessions ?? []) as unknown as {
      id: string;
      session_date: string;
      status: string;
    }[])
      .slice()
      .sort((a, b) => a.session_date.localeCompare(b.session_date))
      .map((s) => ({ id: s.id, date: s.session_date, status: s.status as SessionStatus }));

    return [
      {
        enrollmentId: row.id,
        riderName: rider.full_name || rider.email,
        riderEmail: rider.email,
        planName: plan.name,
        sessionCount: plan.session_count,
        sessions,
      },
    ];
  });
}
