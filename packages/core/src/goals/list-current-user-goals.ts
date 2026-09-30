import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { findActiveGoalId, loadGoalViews } from "./_utils/goal-view";
import { type GoalView } from "./goal-contract";

/**
 * The learner's goals for the goal switcher: the one the tabs show (the main goal, whose session
 * comes first) and the day's total time across active goals ("Today 55 min").
 */
export type GoalList = { activeGoalId: string | null; dailyMinutes: number; goals: GoalView[] };

/** Every goal the learner hasn't archived: the main goal, then the rest oldest first. Null without a session. */
export async function listCurrentUserGoals(): Promise<GoalList | null> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;

  cacheTag(getGoalsCacheTag(userId), getLearningProfileCacheTag(userId));

  const [goals, activeGoalId] = await Promise.all([
    prisma.goal.findMany({
      orderBy: { createdAt: "asc" },
      where: { status: { not: "archived" }, userId },
    }),
    findActiveGoalId(userId),
  ]);

  /** The main goal leads the switcher, as its session leads the day. */
  const ordered = goals.toSorted(
    (a, b) => Number(b.id === activeGoalId) - Number(a.id === activeGoalId),
  );

  return {
    activeGoalId,
    dailyMinutes: goals
      .filter((goal) => goal.status === "active")
      .reduce((total, goal) => total + goal.dailyMinutes, 0),
    goals: await loadGoalViews({ activeGoalId, goals: ordered }),
  };
}
