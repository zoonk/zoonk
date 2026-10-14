import "server-only";
import {
  type UnchangedFocusReason,
  applyChangeNow,
  applySteeringNow,
  isPlanReady,
} from "./_utils/apply-plan-change";
import { findOwnedPlan, loadPlanChangeView } from "./_utils/owned-plan";
import { applyChangeOperations } from "./_utils/part-areas";
import { type PlanContext } from "./_utils/plan-context";
import { assertPlanTargetDates } from "./_utils/plan-target-dates";
import { withPlanRetry } from "./_utils/replan";
import { findSetBackChange } from "./_utils/set-back";
import { undoChange } from "./_utils/undo-change";
import { type PlanChangeInput, type PlanOperation } from "./plan-contract";
import { type PlanChangeView } from "./plan-view-contract";
import { type PlanChangeRefusal } from "./planner/plan-operations";

export type PlanChangeResult =
  | { change: PlanChangeView | null; status: "applied" }
  | PlanChangeRefusal
  /** A focus or "less" that wouldn't do what it asks: nothing saved, and why (see `applySteeringNow`). */
  | { reason: UnchangedFocusReason; status: "unchanged" }
  | { status: "notFound" | "unauthorized" };

/** Not shown to the learner: the app says a learner's own change from its operations. */
const LEARNER_CHANGE_NOTE = "Changed by the learner in the plan.";

/** Moving the week's challenge manages today's session itself: its block steps aside and comes back. */
function isChallengeMove(operation: PlanChangeInput["operations"][number]): boolean {
  return operation.kind === "moveWeeklyEvent";
}

/**
 * Choosing where to focus, or areas to give less time, says when it wouldn't do what it asks
 * instead of saving a change that does nothing or the opposite.
 */
function isSteering(operation: PlanChangeInput["operations"][number]): boolean {
  return operation.kind === "focusAreas" || operation.kind === "reduceAreas";
}

/**
 * Undoes the learner's latest change when their new one sets back by hand what it changed (see
 * `findSetBackChange`), and answers with that change, now undone. Null when it doesn't, or when
 * the plan can't be put back anymore: the new change then applies as any other.
 */
async function undoSetBack({
  context,
  operations,
}: {
  context: PlanContext;
  operations: readonly PlanOperation[];
}): Promise<PlanChangeResult | null> {
  const result = await applyChangeOperations({ context, operations });

  const change =
    "error" in result || !isPlanReady(context)
      ? null
      : await findSetBackChange({ context, operations, state: result.state });

  if (!change || (await undoChange({ change, context }))) {
    return null;
  }

  return { change: await loadPlanChangeView(change.id), status: "applied" };
}

/**
 * Applies a change the learner made in the plan (time, days, a light week, the date, areas or
 * steering) and re-plans from today; the part of today's session not started follows it. Past work
 * never moves, and the change can be undone; setting back by hand what the latest change set is
 * its Undo (see `undoSetBack`). A plan the planner hasn't built yet keeps the settings for when it
 * is, with no change to show. A focus that would move nothing, or more or less of some areas that
 * would do the opposite of what it asks, isn't saved (`unchanged`, with why), so the learner hears
 * it instead of seeing a change that does nothing.
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

    assertPlanTargetDates({ context: owned.context, operations: input.operations });

    const setBack = await undoSetBack({ context: owned.context, operations: input.operations });

    if (setBack) {
      return setBack;
    }

    const request = {
      context: owned.context,
      followToday: !input.operations.every((operation) => isChallengeMove(operation)),
      operations: input.operations,
      reason: LEARNER_CHANGE_NOTE,
      source: "learner",
    } as const;

    const steers = !saveFocusAnyway && input.operations.every((op) => isSteering(op));
    const result = await (steers ? applySteeringNow(request) : applyChangeNow(request));

    if (result.status === "invalid" || result.status === "unchanged") {
      return result;
    }

    const change = result.status === "saved" ? null : await loadPlanChangeView(result.changeId);

    return { change, status: "applied" };
  });
}
