import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRidingLevel } from "@/lib/coach";
import { WEEKDAYS } from "@/lib/coachSchedule";
import { formatGroupTime, formatSessionDate } from "@/lib/sessions";
import { getLessonGroup, getGroupSessions, getEligibleRidersForLevel, type GroupSessionDate } from "@/lib/lessonGroups";
import { getClassTimeSlots } from "@/lib/classTimeSlots";
import {
  updateLessonGroup,
  deleteLessonGroup,
  addMeetingTime,
  removeMeetingTime,
  addGroupMember,
  removeGroupMember,
} from "@/lib/actions/lessonGroups";
import FlashMessage from "@/components/FlashMessage";

function tallySessions(day: GroupSessionDate): string {
  const counts = { scheduled: 0, attended: 0, missed: 0, excused: 0 };
  for (const r of day.riders) counts[r.status] += 1;
  const parts: string[] = [];
  if (counts.attended) parts.push(`${counts.attended} attended`);
  if (counts.missed) parts.push(`${counts.missed} missed`);
  if (counts.excused) parts.push(`${counts.excused} marked out`);
  if (counts.scheduled) parts.push(`${counts.scheduled} scheduled`);
  return parts.join(" · ") || "No riders";
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Check the name, weekday, times, and capacity — capacity must be at least 1.",
  unknown: "Something went wrong — please try again.",
  "has-members": "Remove this group's riders first, or just deactivate it instead.",
  "duplicate-time": "That day and time is already on this group.",
  full: "That group is already at capacity.",
  duplicate: "That rider is already in this group.",
};

export default async function CoachGroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const errorKey = typeof query.error === "string" ? query.error : undefined;
  const updated = query.updated === "1";
  const added = query.added === "1";
  const removed = query.removed === "1";
  const timeAdded = query.timeAdded === "1";
  const timeRemoved = query.timeRemoved === "1";

  const group = await getLessonGroup(id);
  if (!group) notFound();

  const [sessions, eligibleRiders, timeSlots] = await Promise.all([
    getGroupSessions(id),
    getEligibleRidersForLevel(group.level),
    getClassTimeSlots(),
  ]);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const upcomingSessions = sessions.filter((s) => s.date >= todayStr);
  const pastSessions = sessions.filter((s) => s.date < todayStr).slice(-10).reverse();

  return (
    <>
      <p className="eyebrow">
        <Link href="/coach/groups">← Groups</Link>
      </p>
      <h1>{group.name}.</h1>
      <p className="auth-sub">
        {formatRidingLevel(group.level)} · {group.members.length} of {group.capacity} riders
        {!group.active && " · Inactive"}
      </p>

      {errorKey && (
        <FlashMessage param="error" tone="error">
          {ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unknown}
        </FlashMessage>
      )}
      {updated && <FlashMessage param="updated">Group updated.</FlashMessage>}
      {added && <FlashMessage param="added">Rider added — this month's classes are scheduled for her.</FlashMessage>}
      {removed && <FlashMessage param="removed">Rider removed.</FlashMessage>}
      {timeAdded && <FlashMessage param="timeAdded">Meeting time added.</FlashMessage>}
      {timeRemoved && <FlashMessage param="timeRemoved">Meeting time removed.</FlashMessage>}

      <div className="coach-panel-grid">
        <div className="coach-panel">
          <h2 className="coach-subheading">Details</h2>
          <form action={updateLessonGroup} className="slot-edit-form">
            <input type="hidden" name="groupId" value={group.id} />
            <input type="text" name="name" defaultValue={group.name} required />
            <input type="number" name="capacity" min={1} defaultValue={group.capacity} required />
            <label className="slot-active-toggle">
              <input type="checkbox" name="active" defaultChecked={group.active} />
              Active
            </label>
            <button className="primary-button" type="submit">
              Save
            </button>
          </form>
          <form action={deleteLessonGroup} style={{ marginTop: 14 }}>
            <input type="hidden" name="groupId" value={group.id} />
            <input type="hidden" name="level" value={group.level} />
            <button className="text-button" type="submit">
              Delete group
            </button>
          </form>

          <h2 className="coach-subheading">Meeting times</h2>
          {group.meetingTimes.length === 0 ? (
            <p>None yet — add one below.</p>
          ) : (
            <ul className="session-list">
              {group.meetingTimes.map((mt) => (
                <li key={mt.id} className="session-row">
                  <span className="session-date">
                    {mt.weekdayLabel} {formatGroupTime(mt.startTime)}–{formatGroupTime(mt.endTime)}
                  </span>
                  <form action={removeMeetingTime}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="meetingTimeId" value={mt.id} />
                    <button className="text-button" type="submit">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {timeSlots.length === 0 ? (
            <p>
              Add a <Link href="/coach/groups">time slot</Link> first before adding another meeting time.
            </p>
          ) : (
            <form action={addMeetingTime} className="slot-edit-form">
              <input type="hidden" name="groupId" value={group.id} />
              <select name="weekday" defaultValue={2}>
                {WEEKDAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
              <select name="timeSlotId" defaultValue="" required>
                <option value="" disabled>
                  Time slot
                </option>
                {timeSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {formatGroupTime(slot.startTime)}–{formatGroupTime(slot.endTime)}
                  </option>
                ))}
              </select>
              <button className="primary-button" type="submit">
                Add meeting time
              </button>
            </form>
          )}
        </div>

        <div className="coach-panel">
          <h2 className="coach-subheading">Riders</h2>
          {group.members.length === 0 ? (
            <p>No riders in this group yet.</p>
          ) : (
            <ul className="session-list">
              {group.members.map((member) => (
                <li key={member.membershipId} className="session-row">
                  <span className="session-date">{member.riderName}</span>
                  <span>{member.riderEmail}</span>
                  <form action={removeGroupMember}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="membershipId" value={member.membershipId} />
                    <button className="text-button" type="submit">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {eligibleRiders.length > 0 && group.members.length < group.capacity && (
            <form action={addGroupMember} className="coach-level-form">
              <input type="hidden" name="groupId" value={group.id} />
              <select name="enrollmentId" defaultValue="" required>
                <option value="" disabled>
                  Add a rider
                </option>
                {eligibleRiders.map((rider) => (
                  <option key={rider.enrollmentId} value={rider.enrollmentId}>
                    {rider.riderName}
                  </option>
                ))}
              </select>
              <button className="primary-button" type="submit">
                Add
              </button>
            </form>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 30 }}>
        <h2 className="coach-subheading" style={{ margin: 0 }}>
          Sessions
        </h2>
        <Link className="text-button" href={`/coach/sessions?tab=group&openId=${group.id}`}>
          Take attendance
        </Link>
      </div>
      {sessions.length === 0 ? (
        <p>No sessions generated yet — they&apos;ll appear once this group has both a meeting time and riders.</p>
      ) : (
        <div className="coach-panel-grid">
          <div className="coach-panel">
            <h3 className="account-subheading" style={{ marginTop: 0 }}>
              Upcoming
            </h3>
            {upcomingSessions.length === 0 ? (
              <p>Nothing scheduled yet.</p>
            ) : (
              <ul className="session-list">
                {upcomingSessions.map((day) => (
                  <li key={day.date} className="session-row">
                    <span className="session-date">{formatSessionDate(day.date)}</span>
                    <span>{tallySessions(day)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="coach-panel">
            <h3 className="account-subheading" style={{ marginTop: 0 }}>
              Recent
            </h3>
            {pastSessions.length === 0 ? (
              <p>No past sessions yet.</p>
            ) : (
              <ul className="session-list">
                {pastSessions.map((day) => (
                  <li key={day.date} className="session-row">
                    <span className="session-date">{formatSessionDate(day.date)}</span>
                    <span>{tallySessions(day)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
