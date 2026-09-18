import Link from "next/link";
import AccordionItem from "@/components/AccordionItem";
import { RIDING_LEVELS, formatRidingLevel } from "@/lib/coach";
import { WEEKDAYS } from "@/lib/coachSchedule";
import { formatGroupTime } from "@/lib/sessions";
import { getAllLessonGroups } from "@/lib/lessonGroups";
import { getClassTimeSlots } from "@/lib/classTimeSlots";
import { createLessonGroup, deleteLessonGroup } from "@/lib/actions/lessonGroups";
import { addClassTimeSlot, removeClassTimeSlot } from "@/lib/actions/classTimeSlots";
import FlashMessage from "@/components/FlashMessage";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Every group needs a name, at least one weekday, a time slot, and a capacity of at least 1.",
  unknown: "Something went wrong — please try again.",
  "has-members": "Remove this group's riders first, or just deactivate it instead.",
  "duplicate-slot": "That time slot already exists.",
};

export default async function CoachGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const created = params.created === "1";
  const deleted = params.deleted === "1";
  const slotAdded = params.slotAdded === "1";
  const slotRemoved = params.slotRemoved === "1";
  const openLevel = typeof params.level === "string" ? params.level : undefined;

  const [groups, timeSlots] = await Promise.all([getAllLessonGroups(), getClassTimeSlots()]);

  return (
    <>
      <p className="eyebrow">
        <span></span> Coach dashboard
      </p>
      <h1>Groups.</h1>
      <p className="auth-sub">
        The recurring weekly classes each level meets. A group can meet on more than one fixed day a
        week, always at the same time slot — click into one to manage its riders and sessions. Riders
        on a private plan aren&apos;t scheduled here — see Sessions instead.
      </p>

      {errorKey && (
        <FlashMessage param="error" tone="error">
          {ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unknown}
        </FlashMessage>
      )}
      {created && <FlashMessage param="created">Group added.</FlashMessage>}
      {deleted && <FlashMessage param="deleted">Group deleted.</FlashMessage>}
      {slotAdded && <FlashMessage param="slotAdded">Time slot added.</FlashMessage>}
      {slotRemoved && <FlashMessage param="slotRemoved">Time slot removed.</FlashMessage>}

      <div className="coach-panel">
        <h2 className="coach-subheading" style={{ marginTop: 0 }}>
          Time slots
        </h2>
        <p className="auth-sub" style={{ marginBottom: 16 }}>
          The academy&apos;s fixed daily times — every group picks one of these for all the days it meets.
        </p>
        {timeSlots.length > 0 && (
          <ul className="session-list">
            {timeSlots.map((slot) => (
              <li key={slot.id} className="session-row">
                <span className="session-date">
                  {formatGroupTime(slot.startTime)}–{formatGroupTime(slot.endTime)}
                </span>
                <form action={removeClassTimeSlot}>
                  <input type="hidden" name="slotId" value={slot.id} />
                  <button className="text-button" type="submit">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addClassTimeSlot} className="slot-edit-form">
          <input type="time" name="startTime" required />
          <input type="time" name="endTime" required />
          <button className="primary-button" type="submit">
            Add time slot
          </button>
        </form>
      </div>

      <div className="coach-accordion">
        {RIDING_LEVELS.map((level) => {
          const levelGroups = groups.filter((g) => g.level === level);
          const totalMembers = levelGroups.reduce((sum, g) => sum + g.members.length, 0);
          const totalCapacity = levelGroups.reduce((sum, g) => sum + g.capacity, 0);

          return (
            <AccordionItem
              key={level}
              defaultOpen={level === openLevel}
              summary={
                <>
                  <span className="coach-accordion-title">{formatRidingLevel(level)}</span>
                  <span className="coach-accordion-meta">
                    {levelGroups.length === 0
                      ? "No groups yet"
                      : `${levelGroups.length} group${levelGroups.length === 1 ? "" : "s"} · ${totalMembers} of ${totalCapacity} spots filled`}
                    <span className="coach-accordion-chevron" aria-hidden="true" />
                  </span>
                </>
              }
            >
              {levelGroups.length === 0 ? (
                <p>No groups yet for this level.</p>
              ) : (
                <ul className="trial-slot-list">
                  {levelGroups.map((group) => (
                    <li key={group.id} className="coach-row">
                      <Link href={`/coach/groups/${group.id}`} className="trial-slot-info">
                        <strong>
                          {group.name} {!group.active && "(inactive)"}
                        </strong>
                        <span>
                          {group.meetingTimes
                            .map((mt) => `${mt.weekdayLabel} ${formatGroupTime(mt.startTime)}–${formatGroupTime(mt.endTime)}`)
                            .join(", ") || "No meeting times yet"}
                        </span>
                        <span>
                          {group.members.length} of {group.capacity} riders
                        </span>
                      </Link>
                      <form action={deleteLessonGroup}>
                        <input type="hidden" name="groupId" value={group.id} />
                        <input type="hidden" name="level" value={level} />
                        <button className="text-button" type="submit">
                          Delete
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <form action={createLessonGroup} className="slot-edit-form">
                <input type="hidden" name="level" value={level} />
                <input type="text" name="name" placeholder="Group name" required />
                <fieldset className="weekday-picker">
                  <legend>Days</legend>
                  {WEEKDAYS.map((day, index) => (
                    <label key={day}>
                      <input type="checkbox" name="weekdays" value={index} />
                      {day.slice(0, 3)}
                    </label>
                  ))}
                </fieldset>
                {timeSlots.length === 0 ? (
                  <span>Add a time slot above first.</span>
                ) : (
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
                )}
                <input type="number" name="capacity" min={1} defaultValue={6} required />
                <button className="primary-button" type="submit" disabled={timeSlots.length === 0}>
                  Add {formatRidingLevel(level)} group
                </button>
              </form>
            </AccordionItem>
          );
        })}
      </div>
    </>
  );
}
