import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { findActiveGoalId } from "../../goals/_utils/goal-view";

export function readGoalDetails(goal: Pick<Goal, "details"> | null): Record<string, unknown> {
  return goal && isJsonObject(goal.details) ? goal.details : {};
}

/** A supplied goal must belong to the learner; otherwise the goal they chose, when it's for the language, then their latest active or latest goal for it. */
export async function findLearnerLanguageGoal({
  goalId,
  targetLanguage,
  userId,
}: {
  goalId?: string;
  targetLanguage: string;
  userId: string;
}): Promise<Goal | null> {
  const [goals, activeGoalId] = await Promise.all([
    prisma.goal.findMany({
      orderBy: { updatedAt: "desc" },
      where: { kind: "language", targetLanguage, userId },
    }),
    findActiveGoalId(userId),
  ]);

  const [preferred] = [goalId, activeGoalId].flatMap(
    (id) => goals.find((goal) => goal.id === id) ?? [],
  );

  return preferred ?? goals.find((goal) => goal.status === "active") ?? goals[0] ?? null;
}
