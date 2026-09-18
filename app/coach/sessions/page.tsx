import Link from "next/link";
import AccordionItem from "@/components/AccordionItem";
import { RIDING_LEVELS, formatRidingLevel } from "@/lib/coach";
import { getPaidEnrollmentsWithSessions } from "@/lib/coachSessions";
import { getAllLessonGroups, getGroupSessions, type GroupSessionDate } from "@/lib/lessonGroups";
import { getOpenMakeupSpotsForLevel, ensureCurrentMonthSessions } from "@/lib/makeupSessions";
import { getUpcomingExcusedSessions, getUpcomingMakeupBookings, getUpcomingCapacityOverrides } from "@/lib/coachMakeup";
import { formatSessionDate, formatGroupTime, sessionStatusLabel } from "@/lib/sessions";
import { scheduleSession, markSessionStatus, removeSession, addCapacityOverride, removeCapacityOverride } from "@/lib/actions/coachSessions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Pick a date before scheduling.",
  duplicate: "That rider already has a session on that date.",
  unknown: "Something went wrong — please try again.",
};

// Any single list beyond this many rows gets capped with a "show all" link,
// so one busy queue (or one packed level of makeup spots) doesn't push
// everything else on the tab off screen.
const LIST_CAP = 6;

const TABS = [
  { key: "out", label: "Riders out" },
  { key: "makeup", label: "Makeup bookings" },
  { key: "spots", label: "Open makeup spots" },
  { key: "group", label: "Group attendance" },
  { key: "private", label: "Private schedules" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function CoachSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const scheduled = params.scheduled === "1";
  const updated = params.updated === "1";
  const removed = params.removed === "1";
  const spotAdded = params.spotAdded === "1";
  const spotRemoved = params.spotRemoved === "1";
  const showAll = params.showAll === "1";
  const openId = typeof params.openId === "string" ? params.openId : undefined;
  const activeTab: TabKey = TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : "out";

  await ensureCurrentMonthSessions();

  const enrollments = await getPaidEnrollmentsWithSessions();
  const allGroups = await getAllLessonGroups();
  const groups = allGroups.filter((g) => g.active && g.members.length > 0);
  const activeGroups = allGroups.filter((g) => g.active);
  const today = new Date().toISOString().slice(0, 10);

  const excusedSessions = await getUpcomingExcusedSessions();
  const makeupBookings = await getUpcomingMakeupBookings();
  const capacityOverrides = await getUpcomingCapacityOverrides();
  const openSpotsByLevel = new Map(
    await Promise.all(RIDING_LEVELS.map(async (level) => [level, await getOpenMakeupSpotsForLevel(level)] as const))
  );
  const totalOpenSpots = [...openSpotsByLevel.values()].reduce((sum, spots) => sum + spots.length, 0);

  const visibleExcused = showAll ? excusedSessions : excusedSessions.slice(0, LIST_CAP);
  const visibleMakeup = showAll ? makeupBookings : makeupBookings.slice(0, LIST_CAP);
  const visibleGroups = showAll ? groups : groups.slice(0, LIST_CAP);
  const visibleEnrollments = showAll ? enrollments : enrollments.slice(0, LIST_CAP);

  // Only fetched for the groups actually rendered on this page — the real
  // generated sessions for each, not a free-form date the coach types in.
  const groupSessionsByGroupId =
    activeTab === "group"
      ? new Map(await Promise.all(visibleGroups.map(async (g) => [g.id, await getGroupSessions(g.id)] as const)))
      : new Map<string, GroupSessionDate[]>();

  const showAllHref = `/coach/sessions?tab=${activeTab}&showAll=1`;
  const showLessHref = `/coach/sessions?tab=${activeTab}`;

  return (
    <>
      <p className="eyebrow">
        <span></span> Coach dashboard
      </p>
      <h1>Sessions.</h1>
      <p className="auth-sub">Take attendance for group classes, and schedule dates for private riders.</p>

      {errorKey && <p className="form-error">{ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unknown}</p>}
      {scheduled && <p className="form-success">Session scheduled.</p>}
      {updated && <p className="form-success">Attendance updated.</p>}
      {removed && <p className="form-success">Session removed.</p>}
      {spotAdded && <p className="form-success">Makeup spot added.</p>}
      {spotRemoved && <p className="form-success">Makeup spot removed.</p>}

      <nav className="coach-tabs" aria-label="Sessions views">
        {TABS.map((tab) => {
          const count =
            tab.key === "out"
              ? excusedSessions.length
              : tab.key === "makeup"
                ? makeupBookings.length
                : tab.key === "spots"
                  ? totalOpenSpots
                  : 0;
          const label = count > 0 ? `${tab.label} (${count})` : tab.label;
          return tab.key === activeTab ? (
            <span key={tab.key} className="coach-tab-active">
              {label}
            </span>
          ) : (
            <Link key={tab.key} href={`/coach/sessions?tab=${tab.key}`}>
              {label}
            </Link>
          );
        })}
      </nav>

      {activeTab === "out" && (
        <div className="coach-panel">
          {excusedSessions.length === 0 ? (
            <p>No one has marked themselves out of an upcoming session.</p>
          ) : (
            <>
              <ul className="trial-slot-list">
                {visibleExcused.map((row) => (
                  <li key={row.id} className="coach-row">
                    <div className="trial-slot-info">
                      <strong>{row.riderName}</strong>
                      <span>{row.riderEmail}</span>
                      <span>
                        {formatSessionDate(row.date)}
                        {row.groupLabel ? ` — ${row.groupLabel}` : " — private session"}
                      </span>
                    </div>
                    {row.sessionType === "group" ? (
                      <span>A spot opened automatically for other riders to make up.</span>
                    ) : (
                      <form action={scheduleSession} className="slot-edit-form">
                        <input type="hidden" name="enrollmentId" value={row.enrollmentId} />
                        <input type="hidden" name="makeupOfSessionId" value={row.id} />
                        <input type="hidden" name="tab" value="out" />
                        <input type="hidden" name="showAll" value={showAll ? "1" : ""} />
                        <input type="date" name="date" required />
                        <button className="primary-button" type="submit">
                          Assign makeup session
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              {excusedSessions.length > LIST_CAP && (
                <p className="coach-list-footer">
                  {showAll ? (
                    <Link className="text-button" href={showLessHref}>
                      Show fewer
                    </Link>
                  ) : (
                    <Link className="text-button" href={showAllHref}>
                      Show all {excusedSessions.length}
                    </Link>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "makeup" && (
        <div className="coach-panel">
          {makeupBookings.length === 0 ? (
            <p>No riders have booked a makeup spot yet.</p>
          ) : (
            <>
              <ul className="session-list">
                {visibleMakeup.map((row) => (
                  <li key={row.id} className="session-row">
                    <span className="session-date">
                      {row.riderName} — {formatSessionDate(row.date)} {row.groupLabel}
                    </span>
                    <span className={`session-status session-status--${row.status}`}>
                      {sessionStatusLabel(row.status, row.date)}
                    </span>
                    <div className="session-row-actions">
                      {row.status !== "attended" && (
                        <form action={markSessionStatus}>
                          <input type="hidden" name="sessionId" value={row.id} />
                          <input type="hidden" name="status" value="attended" />
                          <input type="hidden" name="tab" value="makeup" />
                          <input type="hidden" name="showAll" value={showAll ? "1" : ""} />
                          <button className="text-button" type="submit">
                            Mark attended
                          </button>
                        </form>
                      )}
                      {row.status !== "missed" && (
                        <form action={markSessionStatus}>
                          <input type="hidden" name="sessionId" value={row.id} />
                          <input type="hidden" name="status" value="missed" />
                          <input type="hidden" name="tab" value="makeup" />
                          <input type="hidden" name="showAll" value={showAll ? "1" : ""} />
                          <button className="text-button" type="submit">
                            Mark missed
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {makeupBookings.length > LIST_CAP && (
                <p className="coach-list-footer">
                  {showAll ? (
                    <Link className="text-button" href={showLessHref}>
                      Show fewer
                    </Link>
                  ) : (
                    <Link className="text-button" href={showAllHref}>
                      Show all {makeupBookings.length}
                    </Link>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "spots" && (
        <div className="coach-panel">
          <p className="auth-sub" style={{ marginBottom: 16 }}>
            Spots freed by cancellations, plus any you add below — visible to riders at the matching level.
          </p>
          {RIDING_LEVELS.map((level) => {
            const spots = openSpotsByLevel.get(level) ?? [];
            if (spots.length === 0) return null;
            const visible = showAll ? spots : spots.slice(0, LIST_CAP);
            return (
              <div key={level} style={{ marginBottom: 16 }}>
                <strong>{formatRidingLevel(level)}</strong>
                <ul className="trial-slot-list">
                  {visible.map((spot) => (
                    <li key={`${spot.groupId}_${spot.date}`} className="trial-slot-row">
                      <div className="trial-slot-info">
                        <strong>
                          {formatSessionDate(spot.date)} — {spot.weekdayLabel} {formatGroupTime(spot.startTime)}–
                          {formatGroupTime(spot.endTime)}
                        </strong>
                        <span>{spot.available} spot(s) open</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {totalOpenSpots > LIST_CAP && (
            <p className="coach-list-footer">
              {showAll ? (
                <Link className="text-button" href={showLessHref}>
                  Show fewer
                </Link>
              ) : (
                <Link className="text-button" href={showAllHref}>
                  Show all {totalOpenSpots}
                </Link>
              )}
            </p>
          )}

          {capacityOverrides.length > 0 && (
            <>
              <h2 className="coach-subheading">Spots you&apos;ve added</h2>
              <ul className="session-list">
                {capacityOverrides.map((row) => (
                  <li key={row.id} className="session-row">
                    <span className="session-date">
                      {formatSessionDate(row.date)} {row.groupLabel} — {row.extraSpots} extra
                    </span>
                    <form action={removeCapacityOverride}>
                      <input type="hidden" name="overrideId" value={row.id} />
                      <input type="hidden" name="tab" value="spots" />
                      <input type="hidden" name="showAll" value={showAll ? "1" : ""} />
                      <button className="text-button" type="submit">
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="coach-subheading">Add a spot</h2>
          <form action={addCapacityOverride} className="slot-edit-form">
            <input type="hidden" name="tab" value="spots" />
            <input type="hidden" name="showAll" value={showAll ? "1" : ""} />
            <select name="groupId" defaultValue="" required>
              <option value="" disabled>
                Choose a class
              </option>
              {activeGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {formatRidingLevel(group.level)} —{" "}
                  {group.meetingTimes.map((mt) => `${mt.weekdayLabel} ${formatGroupTime(mt.startTime)}`).join(", ")}
                </option>
              ))}
            </select>
            <input type="date" name="date" min={today} required />
            <input type="number" name="extraSpots" min={1} defaultValue={1} required />
            <button className="primary-button" type="submit">
              Add spot
            </button>
          </form>
        </div>
      )}

      {activeTab === "group" && (
        <div className="coach-panel">
          {groups.length === 0 ? (
            <p>No groups have riders yet — add riders from Groups first.</p>
          ) : (
            <>
              <div className="coach-accordion">
                {visibleGroups.map((group) => (
                  <AccordionItem
                    key={group.id}
                    defaultOpen={group.id === openId}
                    summary={
                      <>
                        <span className="coach-accordion-title">
                          {group.name} <Link href={`/coach/groups/${group.id}`}>View</Link>
                        </span>
                        <span className="coach-accordion-meta">
                          {formatRidingLevel(group.level)} ·{" "}
                          {group.meetingTimes
                            .map((mt) => `${mt.weekdayLabel} ${formatGroupTime(mt.startTime)}–${formatGroupTime(mt.endTime)}`)
                            .join(", ")}{" "}
                          · {group.members.length} riders
                          <span className="coach-accordion-chevron" aria-hidden="true" />
                        </span>
                      </>
                    }
                  >
                    {(() => {
                      const sessions = groupSessionsByGroupId.get(group.id) ?? [];
                      const todayEntry = sessions.find((s) => s.date === today);
                      const needsAttention = sessions
                        .filter((s) => s.date < today && s.riders.some((r) => r.status === "scheduled"))
                        .slice(-5)
                        .reverse();

                      const riderRow = (r: GroupSessionDate["riders"][number], date: string) => (
                        <li key={r.sessionId} className="session-row">
                          <span className="session-date">
                            {r.riderName}
                            {r.isMakeup && " (makeup)"}
                          </span>
                          <span className={`session-status session-status--${r.status}`}>
                            {sessionStatusLabel(r.status, date)}
                          </span>
                          {r.status === "scheduled" && (
                            <div className="session-row-actions">
                              <form action={markSessionStatus}>
                                <input type="hidden" name="sessionId" value={r.sessionId} />
                                <input type="hidden" name="status" value="attended" />
                                <input type="hidden" name="tab" value="group" />
                                <input type="hidden" name="openId" value={group.id} />
                                <input type="hidden" name="showAll" value={showAll ? "1" : ""} />
                                <button className="text-button" type="submit">
                                  Mark attended
                                </button>
                              </form>
                              <form action={markSessionStatus}>
                                <input type="hidden" name="sessionId" value={r.sessionId} />
                                <input type="hidden" name="status" value="missed" />
                                <input type="hidden" name="tab" value="group" />
                                <input type="hidden" name="openId" value={group.id} />
                                <input type="hidden" name="showAll" value={showAll ? "1" : ""} />
                                <button className="text-button" type="submit">
                                  Mark missed
                                </button>
                              </form>
                            </div>
                          )}
                        </li>
                      );

                      return (
                        <>
                          <h3 className="account-subheading" style={{ marginTop: 0 }}>
                            Today
                          </h3>
                          {todayEntry ? (
                            <ul className="session-list">{todayEntry.riders.map((r) => riderRow(r, todayEntry.date))}</ul>
                          ) : (
                            <p>No class for this group today.</p>
                          )}

                          {needsAttention.length > 0 && (
                            <>
                              <h3 className="account-subheading">Needs attendance</h3>
                              <ul className="trial-slot-list">
                                {needsAttention.map((day) => (
                                  <li key={day.date} className="coach-row">
                                    <strong>{formatSessionDate(day.date)}</strong>
                                    <ul className="session-list">{day.riders.map((r) => riderRow(r, day.date))}</ul>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}

                          <p className="coach-list-footer">
                            <Link className="text-button" href={`/coach/groups/${group.id}`}>
                              View full schedule
                            </Link>
                          </p>
                        </>
                      );
                    })()}
                  </AccordionItem>
                ))}
              </div>
              {groups.length > LIST_CAP && (
                <p className="coach-list-footer">
                  {showAll ? (
                    <Link className="text-button" href={showLessHref}>
                      Show fewer
                    </Link>
                  ) : (
                    <Link className="text-button" href={showAllHref}>
                      Show all {groups.length}
                    </Link>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "private" && (
        <div className="coach-panel">
          {enrollments.length === 0 ? (
            <p>No private enrollments yet — sessions can be scheduled once a rider&apos;s enrollment is paid.</p>
          ) : (
            <>
              <div className="coach-accordion">
                {visibleEnrollments.map((row) => (
                  <AccordionItem
                    key={row.enrollmentId}
                    defaultOpen={row.enrollmentId === openId}
                    summary={
                      <>
                        <span className="coach-accordion-title">{row.riderName}</span>
                        <span className="coach-accordion-meta">
                          {row.planName} · {row.sessions.length} of {row.sessionCount} scheduled
                          <span className="coach-accordion-chevron" aria-hidden="true" />
                        </span>
                      </>
                    }
                  >
                    <p className="auth-sub" style={{ marginBottom: 12 }}>
                      {row.riderEmail}
                    </p>
                    {row.sessions.length > 0 && (
                      <ul className="session-list">
                        {row.sessions.map((session) => (
                          <li key={session.id} className="session-row">
                            <span className="session-date">{formatSessionDate(session.date)}</span>
                            <span className={`session-status session-status--${session.status}`}>
                              {sessionStatusLabel(session.status, session.date)}
                            </span>
                            <div className="session-row-actions">
                              {session.status !== "attended" && (
                                <form action={markSessionStatus}>
                                  <input type="hidden" name="sessionId" value={session.id} />
                                  <input type="hidden" name="status" value="attended" />
                                  <input type="hidden" name="tab" value="private" />
                                  <input type="hidden" name="openId" value={row.enrollmentId} />
                                  <input type="hidden" name="showAll" value={showAll ? "1" : ""} />
                                  <button className="text-button" type="submit">
                                    Mark attended
                                  </button>
                                </form>
                              )}
                              {session.status !== "missed" && (
                                <form action={markSessionStatus}>
                                  <input type="hidden" name="sessionId" value={session.id} />
                                  <input type="hidden" name="status" value="missed" />
                                  <input type="hidden" name="tab" value="private" />
                                  <input type="hidden" name="openId" value={row.enrollmentId} />
                                  <input type="hidden" name="showAll" value={showAll ? "1" : ""} />
                                  <button className="text-button" type="submit">
                                    Mark missed
                                  </button>
                                </form>
                              )}
                              {session.status === "scheduled" && (
                                <form action={removeSession}>
                                  <input type="hidden" name="sessionId" value={session.id} />
                                  <input type="hidden" name="tab" value="private" />
                                  <input type="hidden" name="openId" value={row.enrollmentId} />
                                  <input type="hidden" name="showAll" value={showAll ? "1" : ""} />
                                  <button className="text-button" type="submit">
                                    Remove
                                  </button>
                                </form>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    {row.sessions.length < row.sessionCount && (
                      <form action={scheduleSession} className="slot-edit-form">
                        <input type="hidden" name="enrollmentId" value={row.enrollmentId} />
                        <input type="hidden" name="tab" value="private" />
                        <input type="hidden" name="openId" value={row.enrollmentId} />
                        <input type="hidden" name="showAll" value={showAll ? "1" : ""} />
                        <input type="date" name="date" required />
                        <button className="primary-button" type="submit">
                          Schedule session
                        </button>
                      </form>
                    )}
                  </AccordionItem>
                ))}
              </div>
              {enrollments.length > LIST_CAP && (
                <p className="coach-list-footer">
                  {showAll ? (
                    <Link className="text-button" href={showLessHref}>
                      Show fewer
                    </Link>
                  ) : (
                    <Link className="text-button" href={showAllHref}>
                      Show all {enrollments.length}
                    </Link>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
