import "server-only";
import { prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { refreshGoalPlan } from "../../plans/refresh-goal-plan";

/** The goals that took the lessons, and the ones whose re-plan failed (logged). */
export type WaitingGoalsReplan = { failedGoalIds: string[]; goalIds: string[] };

type WaitingGoalsQuery = {
  /**
   * Goals re-planned when only part of the band had landed (its first chapter, for a learner
   * waiting on it): they're re-planned again even when no stand-in is left, because a skill whose
   * first lessons replaced its stand-in may have more lessons in the band's later chapters.
   */
  goalIds?: readonly string[];
  skillIds: readonly string[];
};

/**
 * Every active goal still holding a stand-in for one of these skills (a plan item that points at
 * the skill because its lessons weren't outlined yet), and the `goalIds` asked for. Goals of any
 * learner waiting on a shared course, not only the one whose run wrote it.
 */
export async function listGoalsWaitingOnSkills({
  goalIds = [],
  skillIds,
}: WaitingGoalsQuery): Promise<string[]> {
  if (skillIds.length === 0 && goalIds.length === 0) {
    return [];
  }

  const goals = await prisma.goal.findMany({
    select: { id: true },
    where: {
      OR: [
        {
          plan: {
            items: { some: { lessonId: null, skillId: { in: [...skillIds] }, status: "todo" } },
          },
        },
        { id: { in: [...goalIds] } },
      ],
      status: "active",
    },
  });

  return goals.map((goal) => goal.id);
}

/**
 * Re-plans a goal now that an outline gave the skills it waited on their lessons. The graph stays
 * the same, so the real lessons take the stand-ins' places, this week's too, and past work and the
 * dates the learner saw are kept: the plan takes them as any refresh does (see `refreshGoalPlan`).
 * Today's session may have been built from the stand-ins: it takes the real lessons the next time
 * the learner opens it, without moving anything they were shown (see `refreshDayFromPlan`). Throws
 * when the plan kept changing while it was planned (see `isPlanConflictError`), for the caller to
 * try again later.
 */
export async function replanWaitingGoal(goalId: string): Promise<void> {
  await refreshGoalPlan({ goalId });
}

/**
 * Re-plans every goal waiting on these skills (see `listGoalsWaitingOnSkills`), each whatever the
 * others do. Returns the goals re-planned, and the ones whose re-plan failed, each logged, for the
 * caller to try again.
 */
export async function replanGoalsWaitingOnSkills(
  query: WaitingGoalsQuery,
): Promise<WaitingGoalsReplan> {
  const goalIds = await listGoalsWaitingOnSkills(query);
  const results = await Promise.allSettled(goalIds.map((goalId) => replanWaitingGoal(goalId)));

  const failed = goalIds.flatMap((goalId, index) => {
    const result = results[index];

    if (result?.status !== "rejected") {
      return [];
    }

    const reason: unknown = result.reason;
    return [{ goalId, reason }];
  });

  failed.forEach(({ goalId, reason }) => {
    logError(`Could not re-plan goal ${goalId} with the lessons it waited for.`, reason);
  });

  const failedGoalIds = failed.map(({ goalId }) => goalId);

  return { failedGoalIds, goalIds: goalIds.filter((goalId) => !failedGoalIds.includes(goalId)) };
}
