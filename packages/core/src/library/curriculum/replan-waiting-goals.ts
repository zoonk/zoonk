import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { refreshGoalPlan } from "../../plans/refresh-goal-plan";

export type WaitingGoalsReplan = { failedGoalIds: string[]; goalIds: string[] };

type WaitingGoalsQuery = { goalIds?: readonly string[]; skillIds: readonly string[] };

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

/** Throws on a persistent plan conflict so the caller can retry later. */
export async function replanWaitingGoal(goalId: string): Promise<void> {
  await refreshGoalPlan({ goalId, keepsOpenUndo: true, settleMissedDays: false });
}

export async function replanGoalsWaitingOnSkills(
  query: WaitingGoalsQuery,
): Promise<WaitingGoalsReplan> {
  const goalIds = await listGoalsWaitingOnSkills(query);
  const failed: { goalId: string; reason: unknown }[] = [];

  for (const goalId of goalIds) {
    // oxlint-disable-next-line no-await-in-loop -- Re-planning owns a transaction; a popular band must not exhaust the pool.
    const { error } = await safeAsync(() => replanWaitingGoal(goalId));

    if (error) {
      failed.push({ goalId, reason: error });
    }
  }

  failed.forEach(({ goalId, reason }) => {
    logError(`Could not re-plan goal ${goalId} with the lessons it waited for.`, reason);
  });

  const failedGoalIds = failed.map(({ goalId }) => goalId);

  return { failedGoalIds, goalIds: goalIds.filter((goalId) => !failedGoalIds.includes(goalId)) };
}
