import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { isCountryCode } from "@zoonk/utils/countries";
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
import { goalMetadata, saveMetadataInTransaction } from "./_utils/goal-metadata";
import { isGoalRegion } from "./_utils/goal-region";
import { ActiveGoalLimitError, findActiveGoalLimit } from "./_utils/goal-status";
import { findActiveGoalId, loadGoalViews } from "./_utils/goal-view";
import { trackGoalReached } from "./_utils/track-goal-reached";
import { type GoalUpdateInput, type GoalView } from "./goal-contract";

export type GoalUpdateResult =
  | { change: PlanChangeView | null; goal: GoalView; status: "updated" }
  | { error: PlanOperationError; status: "invalid" }
  | { limit: AllowanceLimit; status: "limitReached" }
  | { status: "countryNotOffered" | "notFound" | "regionNotOffered" | "unauthorized" };

/** For logs and admin only; the apps word these changes from their operations. */
const SETTINGS_NOTE = "Changed by the learner in the goal's settings.";
const RESUMED_NOTE = "The goal started again after a pause.";

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
        input.contentCountry !== undefined ||
        input.details !== undefined ||
        input.status !== undefined ||
        input.timeZone !== undefined,
      userId,
    },
    async (tx) => {
      const saved = await saveMetadataInTransaction(tx, { goal, input, userId });
      return saved.changed ? saved : unchanged(saved);
    },
  );
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
    const context = await loadPlanAtToken(goal.id, {
      goalChanges: goalMetadata({ current: goal, input }),
    });

    const writes: { metadata: Awaited<ReturnType<typeof saveMetadataInTransaction>> | null } = {
      metadata: null,
    };

    const saveGoalFields = async (tx: TransactionClient) => {
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
          ? await resumePlan(context, saveGoalFields)
          : null;

      return { changeId, metadata: writes.metadata };
    }

    const result = await applyChangeNow({
      context,
      followToday: true,
      operations,
      reason: SETTINGS_NOTE,
      source: "learner",
      writesWithSave: saveGoalFields,
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

async function saveGoal({
  goal,
  input,
  userId,
}: {
  goal: Goal;
  input: GoalUpdateInput;
  userId: string;
}) {
  const planResult = await updatePlan({ goal, input });

  if ("error" in planResult) {
    return planResult;
  }

  const metadata = planResult.metadata ?? (await saveMetadata({ goal, input, userId }));

  return {
    ...metadata,
    changeId: planResult.changeId,
    savedWithPlan: planResult.metadata !== null,
    status: "saved" as const,
  };
}

function refuseOverLimit(error: unknown): { limit: AllowanceLimit; status: "limitReached" } {
  if (error instanceof ActiveGoalLimitError) {
    return { limit: error.limit, status: "limitReached" };
  }

  throw error;
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

  if (input.targetRegion && !isGoalRegion({ goal, region: input.targetRegion })) {
    return { status: "regionNotOffered" };
  }

  if (
    input.contentCountry !== undefined &&
    (goal.kind === "exam" ||
      goal.kind === "language" ||
      (input.contentCountry !== null && !isCountryCode(input.contentCountry)))
  ) {
    return { status: "countryNotOffered" };
  }

  const isActivating = input.status === "active" && goal.status !== "active";

  /** Skips planning a resume that can't happen; the status write recounts under its lock. */
  const limit = isActivating ? await findActiveGoalLimit({ goalId, userId }) : null;

  if (limit) {
    return { limit, status: "limitReached" };
  }

  const saved = await saveGoal({ goal, input, userId }).catch(refuseOverLimit);

  if (saved.status !== "saved") {
    return saved;
  }

  const { changeId, completed, goal: updated, savedWithPlan } = saved;

  if (
    !savedWithPlan &&
    updated.status === "active" &&
    (input.details !== undefined || input.timeZone !== undefined)
  ) {
    await refreshGoalPlan({ goalId, onConflict: "yield" });
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
        change: changeId ? await loadPlanChangeView(changeId) : null,
        goal: view,
        status: "updated",
      }
    : { status: "notFound" };
}
