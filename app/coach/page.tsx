import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatRidingLevel } from "@/lib/coach";
import { formatGroupTime } from "@/lib/sessions";
import { getCoachOverview } from "@/lib/coachOverview";

export default async function CoachOverviewPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userMetadata = (claims?.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (userMetadata.full_name as string | undefined) ||
    (userMetadata.name as string | undefined) ||
    claims?.email ||
    "coach";

  const overview = await getCoachOverview();

  return (
    <>
      <p className="eyebrow">
        <span></span> Coach dashboard
      </p>
      <h1>Welcome back, {name}.</h1>
      <p className="auth-sub">Here&apos;s what&apos;s happening at the academy today.</p>

      <div className="coach-stat-row" aria-label="Academy overview">
        <div className="coach-stat">
          <strong>{overview.riderCount}</strong>
          <span>
            Registered
            <br />
            riders
          </span>
        </div>
        <div className="coach-stat">
          <strong>{overview.awaitingLevelCount}</strong>
          <span>
            Awaiting a<br />
            level
          </span>
        </div>
        <div className="coach-stat">
          <strong>{overview.upcomingTrialCount}</strong>
          <span>
            Trials
            <br />
            booked
          </span>
        </div>
        <div className="coach-stat">
          <strong>{overview.pendingPaymentCount}</strong>
          <span>
            Payments
            <br />
            pending
          </span>
        </div>
        <div className="coach-stat">
          <strong>{overview.activeEnrollmentCount}</strong>
          <span>
            Active
            <br />
            enrollments
          </span>
        </div>
      </div>

      {(overview.awaitingLevelCount > 0 || overview.pendingPaymentCount > 0) && (
        <>
          <h2 className="coach-subheading">Needs attention</h2>
          <ul className="trial-slot-list">
            {overview.awaitingLevelCount > 0 && (
              <li className="trial-slot-row">
                <div className="trial-slot-info">
                  <strong>
                    {overview.awaitingLevelCount} rider{overview.awaitingLevelCount === 1 ? "" : "s"} awaiting a level
                  </strong>
                  <span>Set a level after their trial so they can enroll.</span>
                </div>
                <Link className="text-button" href="/coach/riders">
                  Review riders
                </Link>
              </li>
            )}
            {overview.pendingPaymentCount > 0 && (
              <li className="trial-slot-row">
                <div className="trial-slot-info">
                  <strong>
                    {overview.pendingPaymentCount} payment{overview.pendingPaymentCount === 1 ? "" : "s"} pending
                  </strong>
                  <span>Mark as paid once a rider pays in cash.</span>
                </div>
                <Link className="text-button" href="/coach/payments">
                  Review payments
                </Link>
              </li>
            )}
          </ul>
        </>
      )}

      <h2 className="coach-subheading">Today&apos;s classes</h2>
      {overview.todaysGroups.length === 0 ? (
        <p>No group classes meet today.</p>
      ) : (
        <ul className="trial-slot-list">
          {overview.todaysGroups.map((group) => (
            <li key={`${group.id}_${group.startTime}`} className="trial-slot-row">
              <div className="trial-slot-info">
                <strong>
                  {formatRidingLevel(group.level)} — {formatGroupTime(group.startTime)}–
                  {formatGroupTime(group.endTime)}
                </strong>
                <span>
                  {group.memberCount} rider{group.memberCount === 1 ? "" : "s"}
                </span>
              </div>
              <Link className="primary-button" href="/coach/sessions">
                Take attendance
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
