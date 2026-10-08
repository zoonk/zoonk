import "server-only";
import { prisma } from "@zoonk/db";
import { refreshGoalPlan } from "../../plans/refresh-goal-plan";

/**
 * Today's session may have been built from the stand-ins: it takes the real lessons the next time
 * the learner opens it, without moving anything they were shown (see `refreshDayFromPlan`). The
 * plan takes them as any refresh does: this week's in place of their stand-ins, the rest from next
 * week, and nothing else moves (see `refreshGoalPlan`).
 */
async function replanGoal(goal: { id: string }): Promise<void> {
  await refreshGoalPlan({ goalId: goal.id });
}

/**
 * Re-plans every active goal still holding a stand-in for one of these skills (a plan item that
 * points at the skill because its lessons weren't outlined yet), now that an outline gave the
 * skills their lessons. The graph stays the same, so the real lessons take the stand-ins' places,
 * this week's too, and past work and the dates the learner saw are kept. Goals of any learner
 * waiting on a shared course benefit, not only the one whose run wrote it. Returns the goal ids.
 *
 * `goalIds` are goals re-planned when only part of the band had landed (its first chapter, for a
 * learner waiting on it): they're re-planned again even when no stand-in is left, because a skill
 * whose first lessons replaced its stand-in may have more lessons in the band's later chapters.
 */
export async function replanGoalsWaitingOnSkills({
  goalIds = [],
  skillIds,
}: {
  goalIds?: readonly string[];
  skillIds: readonly string[];
}): Promise<string[]> {
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

  const results = await Promise.allSettled(goals.map((goal) => replanGoal(goal)));

  return goals.filter((_, index) => results[index]?.status === "fulfilled").map((goal) => goal.id);
}
