import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type TransactionClient } from "@zoonk/db";
import { trackPlanEdited } from "../analytics/track-plan-edited";
import { oweGoalLessons } from "../follow-ups/owe-goal-lessons";
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
import { unlessPlanConflict, withPlanRetry } from "./plan-conflict";
import { type PlanChangeInput, type PlanOperation } from "./plan-contract";
import { type PlanChangeView } from "./plan-view-contract";
import { type PlanChangeRefusal } from "./planner/plan-operations";

export type PlanChangeResult =
  | { change: PlanChangeView | null; status: "applied" }
  | PlanChangeRefusal
  | { reason: UnchangedFocusReason; status: "unchanged" }
  | { status: "conflict" | "notFound" | "unauthorized" };

/** For logs and admin only; the apps word a learner's change from its operations. */
const LEARNER_CHANGE_NOTE = "Changed by the learner in the plan.";

function isChallengeMove(operation: PlanChangeInput["operations"][number]): boolean {
  return operation.kind === "moveWeeklyEvent";
}

function isSteering(operation: PlanChangeInput["operations"][number]): boolean {
  return operation.kind === "focusAreas" || operation.kind === "reduceAreas";
}

async function resolveExistingPlanChange({
  context,
  operations,
}: {
  context: PlanContext;
  operations: readonly PlanOperation[];
}): Promise<PlanChangeResult | null> {
  const result = await applyChangeOperations({ context, operations });

  if ("error" in result) {
    return null;
  }

  if (
    operations.length > 0 &&
    operations.every(({ kind }) => kind === "setExtras") &&
    isDeepStrictEqual(new Set(result.state.settings.extras), new Set(context.state.settings.extras))
  ) {
    return { reason: "alreadyIn", status: "unchanged" };
  }

  const change = isPlanReady(context)
    ? await findSetBackChange({ context, operations, state: result.state })
    : null;

  if (!change || (await undoChange({ change, context }))) {
    return null;
  }

  return { change: await loadPlanChangeView(change.id), status: "applied" };
}

type PlanChangeRequest = {
  goalId: string;
  input: PlanChangeInput;
  source?: "learner" | "mock";
  trackAnalytics?: boolean;
};

/** `conflict`: other plan writes won both tries, such as a new plan filling in, and nothing saved. */
export async function changeGoalPlan(request: PlanChangeRequest): Promise<PlanChangeResult> {
  return (await unlessPlanConflict(() => applyGoalPlanChange(request))) ?? { status: "conflict" };
}

async function applyGoalPlanChange({
  goalId,
  input,
  source = "learner",
  trackAnalytics = true,
}: PlanChangeRequest): Promise<PlanChangeResult> {
  return withPlanRetry(async () => {
    const owned = await findOwnedPlan({ goalId, timeZone: input.timeZone });

    if (owned.status !== "ready") {
      return owned;
    }

    assertPlanTargetDates({ context: owned.context, operations: input.operations });

    const existing = await resolveExistingPlanChange({
      context: owned.context,
      operations: input.operations,
    });

    if (existing?.status === "unchanged") {
      return existing;
    }

    const { goal } = owned.context;

    if (existing) {
      trackPlanEdited({
        changeKind: input.operations.map((operation) => operation.kind).join(","),
        enabled: trackAnalytics,
        goalId,
        userId: goal.userId,
      });

      return existing;
    }

    const request = {
      context: owned.context,
      extraWrites: (tx: TransactionClient) =>
        oweGoalLessons({ db: tx, goalId: goal.id, userId: goal.userId }),
      followToday: !input.operations.every((operation) => isChallengeMove(operation)),
      operations: input.operations,
      reason: LEARNER_CHANGE_NOTE,
      source,
    } as const;

    const steers = input.operations.every((op) => isSteering(op));
    const result = await (steers ? applySteeringNow(request) : applyChangeNow(request));

    if (result.status === "invalid" || result.status === "unchanged") {
      return result;
    }

    const change = result.status === "saved" ? null : await loadPlanChangeView(result.changeId);

    trackPlanEdited({
      changeKind: input.operations.map((operation) => operation.kind).join(","),
      enabled: trackAnalytics,
      goalId,
      userId: goal.userId,
    });

    return { change, status: "applied" };
  });
}
