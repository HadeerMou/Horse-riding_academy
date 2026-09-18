import Link from "next/link";
import { redirect } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import AccordionItem from "@/components/AccordionItem";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import { createClient } from "@/lib/supabase/server";
import { getUserTrialBooking, formatSlotLabel } from "@/lib/trialSessions";
import { isCoach, formatRidingLevel, type RidingLevel } from "@/lib/coach";
import { getActivePlansForLevel, formatPrice } from "@/lib/plans";
import { getMyEnrollment } from "@/lib/enrollment";
import { enrollInPlan } from "@/lib/actions/enrollment";
import { getSessionsForEnrollment, getMyGroups, formatSessionDate, formatGroupTime, sessionStatusLabel } from "@/lib/sessions";
import { ensureCurrentMonthSessions, getUnresolvedMissedGroupSessions, getOpenMakeupSpotsForLevel } from "@/lib/makeupSessions";
import { markSessionOut, markSessionIn, bookMakeupSpot } from "@/lib/actions/makeupSessions";
import { getUnreadNotificationCount } from "@/lib/notifications";
import FlashMessage from "@/components/FlashMessage";

const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending — pay in cash at the academy to activate",
  paid: "Paid and active",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Something went wrong — please try again.",
  "already-marked": "That session is already accounted for.",
  "no-missed-sessions": "You don't have a missed session to make up right now.",
  "spot-taken": "That spot's already been taken — for a makeup, pick another below; to undo marking out, check with your coach.",
  "already-booked": "You already have a session booked that day.",
  "already-made-up": "You've already booked a makeup for this one — cancel that instead if you don't need it.",
  unknown: "Something went wrong — please try again.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (await isCoach()) redirect("/coach");

  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const enrolled = params.enrolled === "1";
  const markedOut = params.out === "1";
  const markedIn = params.in === "1";
  const makeupBooked = params.makeup === "1";

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const userMetadata = (claims?.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (userMetadata.full_name as string | undefined) ||
    (userMetadata.name as string | undefined) ||
    claims?.email ||
    "";

  const trialBooking = await getUserTrialBooking();

  const { data: profile } = await supabase
    .from("profiles")
    .select("riding_level")
    .eq("id", claims?.sub ?? "")
    .maybeSingle();
  const ridingLevel = (profile?.riding_level ?? null) as RidingLevel | null;

  const enrollment = ridingLevel ? await getMyEnrollment() : null;
  const availablePlans = ridingLevel && !enrollment ? await getActivePlansForLevel(ridingLevel) : [];
  if (enrollment && enrollment.status === "paid" && enrollment.sessionType === "group") {
    // Idempotent — fills in any of this month's classes not yet scheduled
    // (a new month, a just-added meeting time, a just-added membership).
    await ensureCurrentMonthSessions();
  }
  const allSessions = enrollment && enrollment.status === "paid" ? await getSessionsForEnrollment(enrollment.id) : [];
  const now0 = new Date();
  const currentMonthPrefix = `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, "0")}`;
  // Group classes auto-schedule every month going forward, so both the list
  // and the attended count are scoped to the current month — otherwise
  // they'd grow without bound and "X of Y attended" would stop meaning
  // anything after the first month. Private sessions stay all-time, since
  // the coach caps those at the plan's session count directly.
  const sessions =
    enrollment?.sessionType === "group" ? allSessions.filter((s) => s.date.startsWith(currentMonthPrefix)) : allSessions;
  const attendedCount = sessions.filter((s) => s.status === "attended").length;
  const myGroups =
    enrollment && enrollment.status === "paid" && enrollment.sessionType === "group"
      ? await getMyGroups(enrollment.id)
      : [];
  const unresolvedMissed =
    enrollment && enrollment.status === "paid" && enrollment.sessionType === "group"
      ? await getUnresolvedMissedGroupSessions(enrollment.id)
      : [];
  const openSpots =
    enrollment && enrollment.status === "paid" && enrollment.sessionType === "group" && unresolvedMissed.length > 0
      ? await getOpenMakeupSpotsForLevel(enrollment.planLevel)
      : [];
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const unreadCount = await getUnreadNotificationCount();

  return (
    <div className="auth-body">
      <AuthHeader>
        <div className="auth-header-actions">
          <NotificationBell userId={claims?.sub ?? ""} initialCount={unreadCount} href="/account/notifications" />
          <SignOutButton />
        </div>
      </AuthHeader>

      <main className="auth-main">
        <div className="auth-card account-card">
          <p className="eyebrow">
            <span></span> Your account
          </p>
          <h1>Welcome, {name}.</h1>

          {errorKey && (
            <FlashMessage param="error" tone="error">
              {ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unknown}
            </FlashMessage>
          )}
          {enrolled && <FlashMessage param="enrolled">Enrolled — pay in cash at the academy to activate.</FlashMessage>}
          {markedOut && <FlashMessage param="out">Marked out — your coach has been notified.</FlashMessage>}
          {markedIn && <FlashMessage param="in">You're back in — your coach has been notified.</FlashMessage>}
          {makeupBooked && <FlashMessage param="makeup">Makeup session booked.</FlashMessage>}

          <div className="account-status">
            <div className="account-status-row">
              <span>Riding level</span>
              <strong>{formatRidingLevel(ridingLevel)}</strong>
            </div>
            {!ridingLevel && (
              <p>
                A coach will meet you at your trial session and set your level — Foundation,
                Progression, Performance, or Elite — based on where you&apos;re starting from.
              </p>
            )}
            {trialBooking ? (
              <p>
                Trial session booked: <strong>{formatSlotLabel(trialBooking)}</strong>
              </p>
            ) : !ridingLevel ? (
              <Link className="primary-button" href="/account/trial">
                Book your trial session
              </Link>
            ) : null}
          </div>

          <div className="account-status account-status--muted">
            <div className="account-status-row">
              <span>My plan</span>
              <strong>{enrollment ? enrollment.planName : "Not enrolled"}</strong>
            </div>

            {!ridingLevel ? (
              <p>Once a coach sets your level after your trial, you&apos;ll be able to enroll in a plan here.</p>
            ) : enrollment ? (
              <>
                <p>
                  {enrollment.sessionCount} sessions · {formatPrice(enrollment.price)} ·{" "}
                  {enrollment.sessionType === "private" ? "Private" : "Group"}
                </p>
                <p>{ENROLLMENT_STATUS_LABEL[enrollment.status] ?? enrollment.status}</p>
              </>
            ) : availablePlans.length === 0 ? (
              <p>No plans are available for your level yet — check back soon.</p>
            ) : (
              <ul className="trial-slot-list">
                {availablePlans.map((plan) => {
                  const bullets = (plan.description ?? "")
                    .split(";")
                    .map((item) => item.trim())
                    .filter(Boolean);
                  return (
                  <li key={plan.id} className="trial-slot-row">
                    <div className="trial-slot-info">
                      <strong>{plan.name}</strong>
                      <span>
                        {plan.sessionCount} sessions · {formatPrice(plan.price)}
                      </span>
                      {bullets.length > 0 && (
                        <ul className="level-includes">
                          {bullets.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <form action={enrollInPlan} className="enroll-form">
                      <input type="hidden" name="planId" value={plan.id} />
                      <label className="session-type-option">
                        <input type="radio" name="sessionType" value="group" defaultChecked />
                        Group sessions
                      </label>
                      <label className="session-type-option">
                        <input type="radio" name="sessionType" value="private" />
                        Private sessions
                      </label>
                      <button className="primary-button" type="submit">
                        Enroll
                      </button>
                    </form>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>

          {enrollment && enrollment.status === "paid" && (
            <div className="account-status account-status--muted">
              <div className="account-status-row">
                <span>{enrollment.sessionType === "group" ? "This month" : "My sessions"}</span>
                <strong>
                  {attendedCount} of {enrollment.sessionCount} attended
                </strong>
              </div>

              {enrollment.sessionType === "group" && (
                <p>
                  {myGroups.length === 0
                    ? "Your coach hasn't placed you in a weekly group yet."
                    : `Weekly classes: ${myGroups
                        .flatMap((g) => g.meetingTimes)
                        .map((m) => `${m.weekdayLabel} ${formatGroupTime(m.startTime)}–${formatGroupTime(m.endTime)}`)
                        .join(", ")}`}
                </p>
              )}

              {sessions.length === 0 ? (
                <p>
                  {enrollment.sessionType === "private"
                    ? "Your coach will add your session schedule here once it's set."
                    : "Your classes for the month will show up here once your coach places you in a group."}
                </p>
              ) : (
                <ul className="session-list">
                  {sessions.map((session) => (
                    <li key={session.id} className="session-row">
                      <span className="session-date">
                        {formatSessionDate(session.date)}
                        {session.groupLabel && ` — ${session.groupLabel}`}
                        {session.isMakeup && " (makeup)"}
                      </span>
                      <span className={`session-status session-status--${session.status}`}>
                        {sessionStatusLabel(session.status, session.date)}
                      </span>
                      {session.status === "scheduled" && session.date >= today && (
                        <div className="session-row-actions">
                          <form action={markSessionOut}>
                            <input type="hidden" name="sessionId" value={session.id} />
                            <button className="text-button" type="submit">
                              Mark as out
                            </button>
                          </form>
                        </div>
                      )}
                      {session.status === "excused" && session.date >= today && (
                        <div className="session-row-actions">
                          <form action={markSessionIn}>
                            <input type="hidden" name="sessionId" value={session.id} />
                            <button className="text-button" type="submit">
                              I&apos;ll attend after all
                            </button>
                          </form>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* The open-spot list is long and only matters when the rider
                  actually wants to rebook, so it stays folded away behind the
                  missed-session count until they open it. */}
              {enrollment.sessionType === "group" && unresolvedMissed.length > 0 && (
                <div className="makeup-accordion">
                  <AccordionItem
                    summary={
                      <>
                        <span className="coach-accordion-title">Make up a missed session</span>
                        <span className="coach-accordion-meta">
                          {unresolvedMissed.length} to book
                          <span className="coach-accordion-chevron" aria-hidden="true" />
                        </span>
                      </>
                    }
                  >
                    <p>
                      You have {unresolvedMissed.length} missed session{unresolvedMissed.length === 1 ? "" : "s"} to
                      make up. Book any open spot below.
                    </p>
                    {openSpots.length === 0 ? (
                      <p>No open spots right now — check back soon.</p>
                    ) : (
                      <ul className="trial-slot-list">
                        {openSpots.map((spot) => (
                          <li key={`${spot.groupId}_${spot.date}`} className="trial-slot-row">
                            <div className="trial-slot-info">
                              <strong>
                                {formatSessionDate(spot.date)} — {spot.weekdayLabel} {formatGroupTime(spot.startTime)}–
                                {formatGroupTime(spot.endTime)}
                              </strong>
                              <span>{spot.available} spot(s) open</span>
                            </div>
                            <form action={bookMakeupSpot}>
                              <input type="hidden" name="groupId" value={spot.groupId} />
                              <input type="hidden" name="date" value={spot.date} />
                              <button className="primary-button" type="submit">
                                Book this spot
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                  </AccordionItem>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
