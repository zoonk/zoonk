import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
} from "../cache/tags";
import { type AllowanceLimit } from "../entitlements/contract";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { applyChangeNow, isPlanReady } from "../plans/_utils/apply-plan-change";
import { loadPlanChangeView } from "../plans/_utils/owned-plan";
import { toPlanChangePayload } from "../plans/_utils/plan-change-payload";
import { type PlanContext, loadPlanContext } from "../plans/_utils/plan-context";
import { commitPlan, withPlanRetry } from "../plans/_utils/replan";
import { computeResumedPlan } from "../plans/_utils/resumed-plan";
import { type PlanChangeView } from "../plans/plan-view-contract";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { type PlanOperationError } from "../plans/planner/plan-operations";
import { getScheduleOperations } from "../plans/planner/schedule-operations";
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

/** Plain notes for logs and admin; the apps say these changes from their operations. */
const SETTINGS_NOTE = "Changed by the learner in the goal's settings.";
const RESUMED_NOTE = "The goal started again after a pause.";

/**
 * A goal back from a pause keeps its plan, or starts it again from today when the pause left
 * lessons behind (see `computeResumedPlan`): the paused days aren't missed days.
 */
async function resumePlan(context: PlanContext): Promise<string | null> {
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
  });
}

async function updatePlan({ goal, input }: { goal: Goal; input: GoalUpdateInput }) {
  return withPlanRetry(async () => {
    const context = await loadPlanContext({ goal, timeZone: input.timeZone });

    // Checked against the plan's own today and date, before anything is planned or saved.
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

      return {
        changeId: context && isResuming && isPlanReady(context) ? await resumePlan(context) : null,
      };
    }

    const result = await applyChangeNow({
      context,
      followToday: true,
      operations,
      reason: SETTINGS_NOTE,
      source: "learner",
    });

    if (result.status === "invalid") {
      return result;
    }

    return { changeId: result.status === "saved" ? null : result.changeId };
  });
}

/**
 * Updates a goal from its settings or the goal switcher: title and details, the learner's time,
 * study days and date (which re-plan from today, with an undo), and pausing, resuming, archiving
 * or completing it. Resuming counts against the learner's active goals.
 */
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

  const updated = await prisma.goal.update({
    data: {
      details: input.details,
      status: input.status,
      studyTime: input.studyTime,
      timezone: input.timeZone,
      title: input.title,
    },
    where: { id: goalId },
  });

  if (input.status) {
    await moveActiveGoalAway({ goalId, status: input.status, userId });
  }

  if (input.status === "completed" && goal.status !== "completed") {
    trackGoalReached(goal);
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
