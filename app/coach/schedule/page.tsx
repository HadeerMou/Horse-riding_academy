import { getAllTrialSlots, WEEKDAYS } from "@/lib/coachSchedule";
import { createTrialSlot, updateTrialSlot } from "@/lib/actions/coachSchedule";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Check the weekday, times, and capacity — capacity must be at least 1.",
  unknown: "Something went wrong — please try again.",
};

export default async function CoachSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const updated = params.updated === "1";
  const created = params.created === "1";

  const slots = await getAllTrialSlots();

  return (
    <>
      <p className="eyebrow">
        <span></span> Coach dashboard
      </p>
      <h1>Weekly schedule.</h1>
      <p className="auth-sub">These recurring times are what riders see when booking a trial session.</p>

      {errorKey && <p className="form-error">{ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unknown}</p>}
      {updated && <p className="form-success">Slot updated.</p>}
      {created && <p className="form-success">New slot added.</p>}

      {slots.length === 0 ? (
        <p>No slots defined yet — add one below.</p>
      ) : (
        <ul className="trial-slot-list">
          {slots.map((slot) => (
            <li key={slot.id} className="coach-row">
              <form action={updateTrialSlot} className="slot-edit-form">
                <input type="hidden" name="slotId" value={slot.id} />
                <select name="weekday" defaultValue={slot.weekday}>
                  {WEEKDAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
                <input type="time" name="startTime" defaultValue={slot.startTime.slice(0, 5)} required />
                <input type="time" name="endTime" defaultValue={slot.endTime.slice(0, 5)} required />
                <input type="number" name="capacity" min={1} defaultValue={slot.capacity} required />
                <label className="slot-active-toggle">
                  <input type="checkbox" name="active" defaultChecked={slot.active} />
                  Active
                </label>
                <button className="primary-button" type="submit">
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <h2 className="coach-subheading">Add a new slot</h2>
      <form action={createTrialSlot} className="slot-edit-form">
        <select name="weekday" defaultValue={2}>
          {WEEKDAYS.map((day, index) => (
            <option key={day} value={index}>
              {day}
            </option>
          ))}
        </select>
        <input type="time" name="startTime" required />
        <input type="time" name="endTime" required />
        <input type="number" name="capacity" min={1} defaultValue={4} required />
        <button className="primary-button" type="submit">
          Add slot
        </button>
      </form>
    </>
  );
}
