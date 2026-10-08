import "server-only";
import {
  type UnchangedFocusReason,
  applyChangeNow,
  applyFocusNow,
} from "./_utils/apply-plan-change";
import { findOwnedPlan, loadPlanChangeView } from "./_utils/owned-plan";
import { withPlanRetry } from "./_utils/replan";
import { type PlanChangeInput } from "./plan-contract";
import { type PlanChangeView } from "./plan-view-contract";
import { type PlanOperationError } from "./planner/plan-operations";

export type PlanChangeResult =
  | { change: PlanChangeView | null; status: "applied" }
  | { error: PlanOperationError; status: "invalid" }
  /** A focus that would leave the plan as it is: nothing saved, and why (see `applyChangeNow`). */
  | { reason: UnchangedFocusReason; status: "unchanged" }
  | { status: "notFound" | "unauthorized" };

/** Not shown to the learner: the app says a learner's own change from its operations. */
const LEARNER_CHANGE_NOTE = "Changed by the learner in the plan.";

/** Moving the week's challenge manages today's session itself: its block steps aside and comes back. */
function isChallengeMove(operation: PlanChangeInput["operations"][number]): boolean {
  return operation.kind === "moveWeeklyEvent";
}

/** Choosing where to focus says when nothing would move instead of saving a change that does nothing. */
function isFocus(operation: PlanChangeInput["operations"][number]): boolean {
  return operation.kind === "focusAreas";
}

/**
 * Applies a change the learner made in the plan (time, days, a light week, the date, areas or
 * steering) and re-plans from today; the part of today's session not started follows it. Past work
 * never moves, and the change can be undone. A plan the planner hasn't built yet keeps the settings
 * for when it is, with no change to show. A focus that would move nothing isn't saved
 * (`unchanged`, with why), so the learner hears it instead of seeing a change that does nothing.
 */
export async function changeGoalPlan({
  goalId,
  input,
  saveFocusAnyway = false,
}: {
  goalId: string;
  input: PlanChangeInput;
  /** Saves a focus even when nothing would move, as the focus test's choice is kept. */
  saveFocusAnyway?: boolean;
}): Promise<PlanChangeResult> {
  return withPlanRetry(async () => {
    const owned = await findOwnedPlan({ goalId, timeZone: input.timeZone });

    if (owned.status !== "ready") {
      return owned;
    }

    const request = {
      context: owned.context,
      followToday: !input.operations.every((operation) => isChallengeMove(operation)),
      operations: input.operations,
      reason: LEARNER_CHANGE_NOTE,
      source: "learner",
    } as const;

    const choosesFocus = !saveFocusAnyway && input.operations.every((op) => isFocus(op));
    const result = await (choosesFocus ? applyFocusNow(request) : applyChangeNow(request));

    if (result.status === "invalid" || result.status === "unchanged") {
      return result;
    }

    const change = result.status === "saved" ? null : await loadPlanChangeView(result.changeId);

    return { change, status: "applied" };
  });
}
