import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
} from "../cache/tags";
import { type AllowanceLimit } from "../entitlements/contract";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { applyChangeNow, isPlanReady } from "../plans/_utils/apply-plan-change";
import { commitPlan } from "../plans/_utils/commit-plan";
import { loadPlanChangeView } from "../plans/_utils/owned-plan";
import { toPlanChangePayload } from "../plans/_utils/plan-change-payload";
import { type PlanContext } from "../plans/_utils/plan-context";
import { loadPlanAtToken } from "../plans/_utils/plan-token";
import { computeResumedPlan } from "../plans/_utils/resumed-plan";
import { withPlanRetry } from "../plans/plan-conflict";
import { type PlanChangeView } from "../plans/plan-view-contract";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { type PlanOperationError } from "../plans/planner/plan-operations";
import { getScheduleOperations } from "../plans/planner/schedule-operations";
import { refreshGoalPlan } from "../plans/refresh-goal-plan";
import { assertTargetDates } from "../plans/target-date-range";
import { findActiveGoalLimit, moveActiveGoalAway } from "./_utils/goal-status";
import { findActiveGoalId, loadGoalViews } from "./_utils/goal-view";
import { trackGoalReached } from "./_utils/track-goal-reached";
import { type GoalUpdateInput, type GoalView } from "./goal-contract";

export type GoalUpdateResult =
  | { change: PlanChangeView | null; goal: GoalView; status: "updated" }
  | { error: PlanOperationError; status: "invalid" }
  | { limit: AllowanceLimit; status: "limitReached" }
  | { status: "notFound" | "unauthorized" };

/** For logs and admin only; the apps word these changes from their operations. */
const SETTINGS_NOTE = "Changed by the learner in the goal's settings.";
const RESUMED_NOTE = "The goal started again after a pause.";

function goalMetadata(input: GoalUpdateInput) {
  return {
    details: input.details,
    status: input.status,
    studyTime: input.studyTime,
    timezone: input.timeZone,
    title: input.title,
  };
}

function changesMetadata(goal: Goal, input: GoalUpdateInput): boolean {
  return Object.entries(goalMetadata(input)).some(
    ([key, value]) => value !== undefined && !isDeepStrictEqual(value, Reflect.get(goal, key)),
  );
}

async function saveMetadata({
  goal,
  input,
  userId,
}: {
  goal: Goal;
  input: GoalUpdateInput;
  userId: string;
}) {
  return writeLearnerChange(
    {
      planInputs:
        input.details !== undefined || input.status !== undefined || input.timeZone !== undefined,
      userId,
    },
    async (tx) => {
      const saved = await saveMetadataInTransaction(tx, { goal, input, userId });
      return saved.changed ? saved : unchanged(saved);
    },
  );
}

async function saveMetadataInTransaction(
  tx: TransactionClient,
  { goal, input, userId }: { goal: Goal; input: GoalUpdateInput; userId: string },
) {
  const current = await tx.goal.findFirstOrThrow({ where: { id: goal.id, userId } });
  const changed = changesMetadata(current, input);

  const updated = changed
    ? await tx.goal.update({ data: goalMetadata(input), where: { id: current.id } })
    : current;

  const moved = input.status
    ? await moveActiveGoalAway({ goalId: goal.id, status: input.status, tx, userId })
    : 0;

  if (!changed && moved === 0) {
    return { changed: false, completed: false, goal: current };
  }

  return {
    changed: true,
    completed: current.status !== "completed" && updated.status === "completed",
    goal: updated,
  };
}

async function resumePlan(
  context: PlanContext,
  extraWrites: (tx: TransactionClient) => Promise<unknown>,
): Promise<string | null> {
  const resumed = await computeResumedPlan(context);

  if (!resumed) {
    return null;
  }

  return commitPlan({
    change: {
      kind: "resumed",
      payload: toPlanChangePayload({
        carriedItemIds: resumed.carriedItemIds,
        effect: resumed.effect,
        source: "system",
      }),
      reason: RESUMED_NOTE,
      status: "applied",
    },
    computed: resumed.computed,
    context,
    extraWrites,
  });
}

async function updatePlan({ goal, input }: { goal: Goal; input: GoalUpdateInput }) {
  return withPlanRetry(async () => {
    const context = await loadPlanAtToken(goal.id, { goalChanges: goalMetadata(input) });

    const writes: { metadata: Awaited<ReturnType<typeof saveMetadataInTransaction>> | null } = {
      metadata: null,
    };

    const extraWrites = async (tx: TransactionClient) => {
      writes.metadata = await saveMetadataInTransaction(tx, { goal, input, userId: goal.userId });
    };

    if (context) {
      assertTargetDates({
        latestOnly: true,
        targets: [
          {
            current: context.state.goal.targetDate,
            path: ["targetDate"],
            targetDate: input.targetDate,
          },
        ],
        today: toIsoDate(context.today),
      });
    }

    const operations = context ? getScheduleOperations({ input, state: context.state }) : [];

    if (!context || operations.length === 0) {
      const isResuming = input.status === "active" && goal.status === "paused";

      const changeId =
        context && isResuming && isPlanReady(context)
          ? await resumePlan(context, extraWrites)
          : null;

      return { changeId, metadata: writes.metadata };
    }

    const result = await applyChangeNow({
      context,
      extraWrites,
      followToday: true,
      operations,
      reason: SETTINGS_NOTE,
      source: "learner",
    });

    if (result.status === "invalid") {
      return result;
    }

    return {
      changeId: result.status === "saved" ? null : result.changeId,
      metadata: writes.metadata,
    };
  });
}

export async function updateGoal({
  goalId,
  input,
}: {
  goalId: string;
  input: GoalUpdateInput;
}): Promise<GoalUpdateResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;
  const isActivating = input.status === "active" && goal.status !== "active";
  const limit = isActivating ? await findActiveGoalLimit({ goalId, userId }) : null;

  if (limit) {
    return { limit, status: "limitReached" };
  }

  const planResult = await updatePlan({ goal, input });

  if ("error" in planResult) {
    return planResult;
  }

  const { completed, goal: updated } =
    planResult.metadata ?? (await saveMetadata({ goal, input, userId }));

  if (
    !planResult.metadata &&
    updated.status === "active" &&
    (input.details !== undefined || input.timeZone !== undefined)
  ) {
    await refreshGoalPlan({ goalId });
  }

  if (completed) {
    trackGoalReached(updated);
  }

  revalidateCacheTags([
    getGoalsCacheTag(userId),
    getLearningProfileCacheTag(userId),
    getLearnerModelCacheTag(userId),
  ]);

  const [view] = await loadGoalViews({
    activeGoalId: await findActiveGoalId(userId),
    goals: [updated],
  });

  return view
    ? {
        change: planResult.changeId ? await loadPlanChangeView(planResult.changeId) : null,
        goal: view,
        status: "updated",
      }
    : { status: "notFound" };
}
