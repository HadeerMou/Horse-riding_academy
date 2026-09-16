import { redirect } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import SignOutButton from "@/components/SignOutButton";
import CoachNav from "@/components/CoachNav";
import { isCoach, getAllRiders, formatRidingLevel, RIDING_LEVELS } from "@/lib/coach";
import { formatSlotLabel } from "@/lib/trialSessions";
import { setRiderLevel, cancelRiderBooking } from "@/lib/actions/coach";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Pick a level before saving.",
  unknown: "Something went wrong — please try again.",
};

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const allowed = await isCoach();
  if (!allowed) redirect("/account");

  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const updated = params.updated === "1";
  const cancelled = params.cancelled === "1";
  const search = typeof params.q === "string" ? params.q.trim() : "";

  const riders = await getAllRiders(search || undefined);

  return (
    <div className="auth-body">
      <AuthHeader>
        <SignOutButton />
      </AuthHeader>

      <main className="auth-main">
        <div className="auth-card coach-card">
          <p className="eyebrow">
            <span></span> Coach dashboard
          </p>
          <h1>Riders.</h1>
          <p className="auth-sub">Every registered rider, their trial status, and their assigned level.</p>

          <CoachNav active="/coach" />

          {errorKey && <p className="form-error">{ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unknown}</p>}
          {updated && <p className="form-success">Level saved.</p>}
          {cancelled && <p className="form-success">Booking cancelled.</p>}

          <form className="coach-search" method="get">
            <input type="search" name="q" placeholder="Search by name or email" defaultValue={search} />
            <button className="text-button" type="submit">
              Search
            </button>
          </form>

          {riders.length === 0 ? (
            <p>{search ? "No riders match that search." : "No riders have registered yet."}</p>
          ) : (
            <ul className="trial-slot-list">
              {riders.map((rider) => (
                <li key={rider.riderId} className="coach-row">
                  <div className="trial-slot-info">
                    <strong>{rider.riderName}</strong>
                    <span>{rider.riderEmail}</span>
                    <span>
                      {rider.booking
                        ? `${rider.booking.isUpcoming ? "Trial booked" : "Trial completed"}: ${formatSlotLabel({
                            date: rider.booking.sessionDate,
                            startTime: rider.booking.startTime,
                            endTime: rider.booking.endTime,
                          })}`
                        : "No trial booked"}
                    </span>
                    <span>Current level: {formatRidingLevel(rider.ridingLevel)}</span>
                  </div>

                  <div className="coach-row-actions">
                    <form action={setRiderLevel} className="coach-level-form">
                      <input type="hidden" name="riderId" value={rider.riderId} />
                      <select name="level" defaultValue={rider.ridingLevel ?? ""} required>
                        <option value="" disabled>
                          Choose level
                        </option>
                        {RIDING_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {formatRidingLevel(level)}
                          </option>
                        ))}
                      </select>
                      <button className="primary-button" type="submit">
                        Save
                      </button>
                    </form>

                    {rider.booking?.isUpcoming && (
                      <form action={cancelRiderBooking}>
                        <input type="hidden" name="bookingId" value={rider.booking.id} />
                        <button className="text-button" type="submit">
                          Cancel trial
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
