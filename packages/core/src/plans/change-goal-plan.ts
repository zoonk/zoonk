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
import { findSetBackChange } from "./_utils/set-back";
import { undoChange } from "./_utils/undo-change";
import { withPlanRetry } from "./plan-conflict";
import { type PlanChangeInput, type PlanOperation } from "./plan-contract";
import { type PlanChangeView } from "./plan-view-contract";
import { type PlanChangeRefusal } from "./planner/plan-operations";

export type PlanChangeResult =
  | { change: PlanChangeView | null; status: "applied" }
  | PlanChangeRefusal
  | { reason: UnchangedFocusReason; status: "unchanged" }
  | { status: "notFound" | "unauthorized" };

/** For logs and admin only; the apps word a learner's change from its operations. */
const LEARNER_CHANGE_NOTE = "Changed by the learner in the plan.";

function isChallengeMove(operation: PlanChangeInput["operations"][number]): boolean {
  return operation.kind === "moveWeeklyEvent";
}

function isSteering(operation: PlanChangeInput["operations"][number]): boolean {
  return operation.kind === "focusAreas" || operation.kind === "reduceAreas";
}

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

export async function changeGoalPlan({
  goalId,
  input,
  saveFocusAnyway = false,
}: {
  goalId: string;
  input: PlanChangeInput;
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
