import "server-only";
import { applyChangeNow } from "./_utils/apply-plan-change";
import { findOwnedPlan, loadPlanChangeView } from "./_utils/owned-plan";
import { withPlanRetry } from "./_utils/replan";
import { type PlanChangeInput } from "./plan-contract";
import { type PlanChangeView } from "./plan-view-contract";
import { type PlanOperationError } from "./planner/plan-operations";

export type PlanChangeResult =
  | { change: PlanChangeView | null; status: "applied" }
  | { error: PlanOperationError; status: "invalid" }
  | { status: "notFound" | "unauthorized" };

/** Not shown to the learner: the app says a learner's own change from its operations. */
const LEARNER_CHANGE_NOTE = "Changed by the learner in the plan.";

/**
 * Applies a change the learner made in the plan (time, days, a light week, the date, areas or
 * steering) and re-plans from today. Past work never moves, and the change can be undone. A plan
 * the planner hasn't built yet keeps the settings for when it is, with no change to show.
 */
export async function changeGoalPlan({
  goalId,
  input,
}: {
  goalId: string;
  input: PlanChangeInput;
}): Promise<PlanChangeResult> {
  return withPlanRetry(async () => {
    const owned = await findOwnedPlan({ goalId, timeZone: input.timeZone });

    if (owned.status !== "ready") {
      return owned;
    }

    const result = await applyChangeNow({
      context: owned.context,
      operations: input.operations,
      reason: LEARNER_CHANGE_NOTE,
      source: "learner",
    });

    if (result.status === "invalid") {
      return result;
    }

    const change = result.status === "saved" ? null : await loadPlanChangeView(result.changeId);

    return { change, status: "applied" };
  });
}
