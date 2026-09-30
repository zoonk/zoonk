import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { resetPlannedStudySession } from "../../sessions/ensure-study-session";

const DEFAULT_TIME_ZONE = "UTC";

async function replanGoal(goal: {
  id: string;
  plan: { graph: unknown } | null;
  timezone: string | null;
  userId: string;
}): Promise<void> {
  // Re-plans run in workflow steps, for any learner's goal: no request says which client they use.
  await createGoalPlan({
    goalId: goal.id,
    graph: parsePlanGraph(goal.plan?.graph),
    platform: null,
  });

  // Today's session may have been built from the stand-ins; a session not started yet is rebuilt.
  await resetPlannedStudySession({
    goalId: goal.id,
    localDate: getDateInTimeZone({
      date: new Date(),
      timeZone: goal.timezone ?? DEFAULT_TIME_ZONE,
    }),
    userId: goal.userId,
  });
}

/**
 * Re-plans every active goal still holding a stand-in for one of these skills (a plan item that
 * points at the skill because its lessons weren't outlined yet), now that an outline gave the
 * skills their lessons. The graph stays the same; the plan is rebuilt from today, so the real
 * lessons take the stand-ins' places this week too, and past work is kept. Goals of any learner
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
    select: { id: true, plan: { select: { graph: true } }, timezone: true, userId: true },
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
