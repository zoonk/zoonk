import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getUserSubscriptionCacheTag } from "../cache/tags";
import { arePhaseChallengesRequired } from "../checkpoints/_utils/phase-challenge-access";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { PLAN_STATUS_ITEM_SELECT } from "../preparation/plan-status";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { loadCatchUpItems } from "../sessions/_utils/catch-up";
import { loadExamPrepAccess } from "../sessions/_utils/plus-only-lessons";
import { readPlanAssessment } from "./_utils/plan-assessment";
import { readPlanSummary } from "./_utils/plan-summary";
import { type PlanAssessment } from "./plan-assessment-contract";
import { parsePlanSettings } from "./planner/plan-state";

/** @public The apps' plan routes read it (`@zoonk/core/plans/assessment`). */
export type GoalPlanAssessmentResult =
  | { assessment: PlanAssessment; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/**
 * Where one of the learner's goal plans stands (see `PlanAssessment`): whether it reaches the goal
 * by its date, how the learner keeps its pace, how its life stands and what it may not reflect
 * yet, read from the stored plan on the learner's day. It never plans anything and writes nothing:
 * the plan adapts when something changes, and this reads what that left. A goal without a plan
 * yet is `notFound`.
 * @public The apps' plan routes read it (`@zoonk/core/plans/assessment`).
 */
export async function getGoalPlanAssessment(goalId: string): Promise<GoalPlanAssessmentResult> {
  "use cache: private";

  // The request's date doesn't depend on the goal: it's read alongside it.
  const [owned, dateContext] = await Promise.all([
    findOwnedGoal(goalId),
    getRequestProgressDateContext(),
  ]);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;
  cacheTag(getGoalsCacheTag(userId), getUserSubscriptionCacheTag(userId));

  const timeZone =
    goal.timezone && isValidTimeZone(goal.timezone) ? goal.timezone : dateContext.timeZone;

  const today = getDateInTimeZone({ date: dateContext.currentInstant, timeZone });

  const [plan, catchUp, access, phaseChallengesRequired] = await Promise.all([
    prisma.plan.findUnique({
      select: {
        estimateHours: true,
        id: true,
        items: { select: PLAN_STATUS_ITEM_SELECT },
        pendingAdaptation: true,
        settings: true,
        summary: true,
        version: true,
      },
      where: { goalId },
    }),
    loadCatchUpItems(goalId),
    loadExamPrepAccess({ goal, timeZone, today }),
    arePhaseChallengesRequired({ goalKind: goal.kind, userId }),
  ]);

  if (!plan) {
    return { status: "notFound" };
  }

  return {
    assessment: readPlanAssessment({
      day: today,
      goal,
      items: plan.items,
      pace: {
        catchUp: catchUp.length,
        estimateHours: plan.estimateHours,
        freeWeekOver: access.trialEnded,
        phaseChallengesRequired,
        studiesPastTarget: goal.kind === "exam" && parsePlanSettings(plan.settings).fullCourse,
      },
      pendingAdaptation: plan.pendingAdaptation,
      summary: readPlanSummary({
        plan: { id: plan.id, userId, version: plan.version },
        value: plan.summary,
      }),
    }),
    status: "ready",
  };
}
