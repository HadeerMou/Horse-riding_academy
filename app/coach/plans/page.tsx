import { RIDING_LEVELS, formatRidingLevel } from "@/lib/coach";
import { getAllPlans } from "@/lib/plans";
import { createPlan, updatePlan, deletePlan } from "@/lib/actions/coachPlans";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Fill in a level, name, price, and number of sessions.",
  unknown: "Something went wrong — please try again.",
  "has-enrollments": "Can't delete a plan riders have already enrolled in — deactivate it instead.",
};

export default async function CoachPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const updated = params.updated === "1";
  const created = params.created === "1";
  const deleted = params.deleted === "1";

  const plans = await getAllPlans();

  return (
    <>
      <p className="eyebrow">
        <span></span> Coach dashboard
      </p>
      <h1>Plans.</h1>
      <p className="auth-sub">What riders can enroll in once their level is set.</p>

      {errorKey && <p className="form-error">{ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unknown}</p>}
      {updated && <p className="form-success">Plan updated.</p>}
      {created && <p className="form-success">New plan added.</p>}
      {deleted && <p className="form-success">Plan deleted.</p>}

      {plans.length === 0 ? (
        <p>No plans yet — add one below.</p>
      ) : (
        <ul className="trial-slot-list">
          {plans.map((plan) => (
            <li key={plan.id} className="coach-row">
              <form action={updatePlan} className="plan-edit-form">
                <input type="hidden" name="planId" value={plan.id} />
                <select name="level" defaultValue={plan.level}>
                  {RIDING_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {formatRidingLevel(level)}
                    </option>
                  ))}
                </select>
                <input type="text" name="name" defaultValue={plan.name} placeholder="Plan name" required />
                <input
                  type="text"
                  name="description"
                  defaultValue={plan.description ?? ""}
                  placeholder="What's included, separated by ; (optional)"
                />
                <input type="number" name="price" min={0} step="0.01" defaultValue={plan.price} required />
                <input type="number" name="sessionCount" min={1} defaultValue={plan.sessionCount} required />
                <label className="slot-active-toggle">
                  <input type="checkbox" name="active" defaultChecked={plan.active} />
                  Active
                </label>
                <button className="primary-button" type="submit">
                  Save
                </button>
              </form>
              <form action={deletePlan}>
                <input type="hidden" name="planId" value={plan.id} />
                <button className="text-button" type="submit">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <h2 className="coach-subheading">Add a new plan</h2>
      <form action={createPlan} className="plan-edit-form">
        <select name="level" defaultValue="foundation">
          {RIDING_LEVELS.map((level) => (
            <option key={level} value={level}>
              {formatRidingLevel(level)}
            </option>
          ))}
        </select>
        <input type="text" name="name" placeholder="Plan name" required />
        <input type="text" name="description" placeholder="What's included, separated by ; (optional)" />
        <input type="number" name="price" min={0} step="0.01" placeholder="Price" required />
        <input type="number" name="sessionCount" min={1} placeholder="Sessions" required />
        <button className="primary-button" type="submit">
          Add plan
        </button>
      </form>
    </>
  );
}
