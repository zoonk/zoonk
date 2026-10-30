import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isJsonObject } from "@zoonk/utils/json";
import { logError } from "@zoonk/utils/logger";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { refreshGoalPlan } from "../../plans/refresh-goal-plan";
import { getOnboardingSteps } from "../../view-models/onboarding/onboarding-steps";

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

  const waiting = new Set(goals.map((goal) => goal.id));
  return [...new Set([...goalIds.filter((id) => waiting.has(id)), ...waiting])];
}

/** Background refreshes wait until setup and the first study-day open; both already re-plan. Throws if another plan write wins afterward. */
export async function replanWaitingGoal(goalId: string): Promise<void> {
  const goal = await prisma.goal.findUnique({
    include: { studySessions: { select: { id: true }, take: 1 } },
    where: { id: goalId },
  });

  if (!goal || goal.studySessions.length === 0) {
    return;
  }

  const steps = getOnboardingSteps({
    goal: {
      details: isJsonObject(goal.details) ? goal.details : {},
      kind: goal.kind,
      targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
    },
    profile: { hasBuddy: true, hasEarlierGoals: true },
  });

  if (steps.some((step) => step !== "plan")) {
    return;
  }

  await refreshGoalPlan({
    goalId,
    keepsOpenUndo: true,
    retryOnConflict: false,
    settleMissedDays: false,
  });
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
