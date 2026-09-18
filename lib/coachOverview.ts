import { getAllRiders, type RidingLevel } from "@/lib/coach";
import { getAllEnrollments } from "@/lib/coachPayments";
import { getAllLessonGroups } from "@/lib/lessonGroups";

export type TodayGroupRow = {
  id: string;
  level: RidingLevel;
  startTime: string;
  endTime: string;
  memberCount: number;
};

export type CoachOverview = {
  riderCount: number;
  awaitingLevelCount: number;
  upcomingTrialCount: number;
  pendingPaymentCount: number;
  activeEnrollmentCount: number;
  todaysGroups: TodayGroupRow[];
};

export async function getCoachOverview(): Promise<CoachOverview> {
  const [riders, enrollments, groups] = await Promise.all([
    getAllRiders(),
    getAllEnrollments(),
    getAllLessonGroups(),
  ]);

  const today = new Date().getDay();

  return {
    riderCount: riders.length,
    awaitingLevelCount: riders.filter((r) => !r.ridingLevel).length,
    upcomingTrialCount: riders.filter((r) => r.booking?.isUpcoming).length,
    pendingPaymentCount: enrollments.filter((e) => e.status === "pending").length,
    activeEnrollmentCount: enrollments.filter((e) => e.status === "paid").length,
    todaysGroups: groups
      .filter((g) => g.active && g.members.length > 0)
      .flatMap((g) =>
        g.meetingTimes
          .filter((mt) => mt.weekday === today)
          .map((mt) => ({
            id: g.id,
            level: g.level,
            startTime: mt.startTime,
            endTime: mt.endTime,
            memberCount: g.members.length,
          }))
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  };
}
