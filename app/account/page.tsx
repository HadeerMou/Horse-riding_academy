import Link from "next/link";
import { redirect } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import SignOutButton from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import { getUserTrialBooking, formatSlotLabel } from "@/lib/trialSessions";
import { isCoach, formatRidingLevel, type RidingLevel } from "@/lib/coach";
import { getActivePlansForLevel, formatPrice } from "@/lib/plans";
import { getMyEnrollment } from "@/lib/enrollment";
import { enrollInPlan } from "@/lib/actions/enrollment";

const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending — pay in cash at the academy to activate",
  paid: "Paid and active",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Something went wrong — please try again.",
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

  return (
    <div className="auth-body">
      <AuthHeader>
        <SignOutButton />
      </AuthHeader>

      <main className="auth-main">
        <div className="auth-card account-card">
          <p className="eyebrow">
            <span></span> Your account
          </p>
          <h1>Welcome, {name}.</h1>

          {errorKey && <p className="form-error">{ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unknown}</p>}
          {enrolled && <p className="form-success">Enrolled — pay in cash at the academy to activate.</p>}

          <div className="account-status">
            <div className="account-status-row">
              <span>Riding level</span>
              <strong>{formatRidingLevel(ridingLevel)}</strong>
            </div>
            <p>
              A coach will meet you at your trial session and set your level — Foundation,
              Progression, Performance, or Elite — based on where you&apos;re starting from.
            </p>
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
                  {enrollment.sessionCount} sessions · {formatPrice(enrollment.price)}
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
                    <form action={enrollInPlan}>
                      <input type="hidden" name="planId" value={plan.id} />
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
        </div>
      </main>
    </div>
  );
}
