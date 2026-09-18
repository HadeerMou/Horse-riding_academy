import { formatRidingLevel } from "@/lib/coach";
import { getAllEnrollments } from "@/lib/coachPayments";
import { formatPrice } from "@/lib/plans";
import { markEnrollmentPaid, cancelEnrollment } from "@/lib/actions/coachPayments";
import FlashMessage from "@/components/FlashMessage";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Missing enrollment.",
  unknown: "Something went wrong — please try again.",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending — cash due at the academy",
  paid: "Paid",
  cancelled: "Cancelled",
};

export default async function CoachPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const updated = params.updated === "1";
  const cancelled = params.cancelled === "1";

  const enrollments = await getAllEnrollments();

  return (
    <>
      <p className="eyebrow">
        <span></span> Coach dashboard
      </p>
      <h1>Payments.</h1>
      <p className="auth-sub">Cash only for now — mark an enrollment paid once the rider pays in person.</p>

      {errorKey && (
        <FlashMessage param="error" tone="error">
          {ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unknown}
        </FlashMessage>
      )}
      {updated && <FlashMessage param="updated">Marked as paid.</FlashMessage>}
      {cancelled && <FlashMessage param="cancelled">Enrollment cancelled.</FlashMessage>}

      {enrollments.length === 0 ? (
        <p>No enrollments yet.</p>
      ) : (
        <ul className="trial-slot-list">
          {enrollments.map((row) => (
            <li key={row.id} className="coach-row">
              <div className="trial-slot-info">
                <strong>{row.riderName}</strong>
                <span>{row.riderEmail}</span>
                <span>
                  {row.planName} ({formatRidingLevel(row.planLevel)}) — {formatPrice(row.price)}
                </span>
                <span>{STATUS_LABEL[row.status] ?? row.status}</span>
              </div>

              {row.status === "pending" && (
                <div className="coach-row-actions">
                  <form action={markEnrollmentPaid}>
                    <input type="hidden" name="enrollmentId" value={row.id} />
                    <button className="primary-button" type="submit">
                      Mark as paid
                    </button>
                  </form>
                  <form action={cancelEnrollment}>
                    <input type="hidden" name="enrollmentId" value={row.id} />
                    <button className="text-button" type="submit">
                      Cancel
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
