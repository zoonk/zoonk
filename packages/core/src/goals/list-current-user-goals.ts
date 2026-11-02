import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import {
  getGoalsCacheTag,
  getLearningProfileCacheTag,
  getUserSubscriptionCacheTag,
} from "../cache/tags";
import { readLearningProfile } from "../learner/facts/learning-profile";
import { getSession } from "../users/get-session";
import { loadGoalViews } from "./_utils/goal-view";
import { type GoalView } from "./goal-contract";

export type GoalList = { activeGoalId: string | null; dailyMinutes: number; goals: GoalView[] };

export async function listCurrentUserGoals(): Promise<GoalList | null> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;

  cacheTag(
    getGoalsCacheTag(userId),
    getLearningProfileCacheTag(userId),
    getUserSubscriptionCacheTag(userId),
  );

  const profile = await readLearningProfile(userId);

  const goals = await prisma.goal.findMany({
    orderBy: { createdAt: "asc" },
    where: {
      OR: [
        { status: { not: "archived" } },
        ...(profile?.activeGoalId ? [{ id: profile.activeGoalId }] : []),
      ],
      userId,
    },
  });

  const activeGoalId = profile?.activeGoalId
    ? (goals.find((goal) => goal.id === profile.activeGoalId)?.id ?? null)
    : (goals.find((goal) => goal.status === "active")?.id ?? null);

  const ordered = goals
    .filter((goal) => goal.status !== "archived")
    .toSorted((a, b) => Number(b.id === activeGoalId) - Number(a.id === activeGoalId));

  return {
    activeGoalId,
    dailyMinutes: goals
      .filter((goal) => goal.status === "active")
      .reduce((total, goal) => total + goal.dailyMinutes, 0),
    goals: await loadGoalViews({ activeGoalId, goals: ordered }),
  };
}
