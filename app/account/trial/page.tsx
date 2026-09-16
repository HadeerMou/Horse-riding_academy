import Link from "next/link";
import AuthHeader from "@/components/AuthHeader";
import SignOutButton from "@/components/SignOutButton";
import { getUpcomingTrialSlots, getUserTrialBooking, formatSlotLabel } from "@/lib/trialSessions";
import { bookTrialSession, cancelTrialBooking } from "@/lib/actions/trialSession";

const ERROR_MESSAGES: Record<string, string> = {
  full: "That session just filled up — pick another time below.",
  duplicate: "You're already booked for that session.",
  invalid: "That session isn't available anymore — pick another time below.",
  unknown: "Something went wrong — please try again.",
};

export default async function TrialSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const booked = params.booked === "1";
  const cancelled = params.cancelled === "1";

  const existingBooking = await getUserTrialBooking();
  const slots = existingBooking ? [] : await getUpcomingTrialSlots();

  return (
    <div className="auth-body">
      <AuthHeader>
        <SignOutButton />
      </AuthHeader>

      <main className="auth-main">
        <div className="auth-card">
          <p className="eyebrow">
            <span></span> Trial session
          </p>
          <h1>Book your trial session.</h1>
          <p className="auth-sub">
            Pick an open time below — your coach will meet you there and set your riding level.
          </p>

          {errorKey && <p className="form-error">{ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unknown}</p>}
          {booked && <p className="form-success">You&apos;re booked — see you there!</p>}
          {cancelled && <p className="form-success">Your booking was cancelled.</p>}

          {existingBooking ? (
            <div className="account-status">
              <div className="account-status-row">
                <span>You&apos;re booked</span>
                <strong>{formatSlotLabel(existingBooking)}</strong>
              </div>
              <form action={cancelTrialBooking}>
                <input type="hidden" name="bookingId" value={existingBooking.id} />
                <button className="text-button" type="submit">
                  Cancel booking
                </button>
              </form>
            </div>
          ) : slots.length === 0 ? (
            <p>No trial sessions are open right now — check back soon.</p>
          ) : (
            <ul className="trial-slot-list">
              {slots.map((slot) => (
                <li key={`${slot.slotId}_${slot.date}`} className="trial-slot-row">
                  <div className="trial-slot-info">
                    <strong>{formatSlotLabel(slot)}</strong>
                    <span>
                      {slot.spotsLeft} spot{slot.spotsLeft === 1 ? "" : "s"} left
                    </span>
                  </div>
                  <form action={bookTrialSession}>
                    <input type="hidden" name="slotId" value={slot.slotId} />
                    <input type="hidden" name="date" value={slot.date} />
                    <button className="primary-button" type="submit" disabled={slot.spotsLeft <= 0}>
                      {slot.spotsLeft <= 0 ? "Full" : "Book this time"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <p className="auth-switch">
            <Link href="/account">Back to account</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
