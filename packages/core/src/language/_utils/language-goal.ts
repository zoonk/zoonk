import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";

export function readGoalDetails(goal: Pick<Goal, "details"> | null): Record<string, unknown> {
  return goal && isJsonObject(goal.details) ? goal.details : {};
}

/**
 * The learner's goal for a language: the one asked for when it's theirs, else their active goal
 * for that language, else their latest. Null when they have none, which is fine for practice.
 */
export async function findLearnerLanguageGoal({
  goalId,
  targetLanguage,
  userId,
}: {
  goalId?: string;
  targetLanguage: string;
  userId: string;
}): Promise<Goal | null> {
  const goals = await prisma.goal.findMany({
    orderBy: { updatedAt: "desc" },
    where: { kind: "language", targetLanguage, userId },
  });

  const asked = goalId ? goals.find((goal) => goal.id === goalId) : null;
  return asked ?? goals.find((goal) => goal.status === "active") ?? goals[0] ?? null;
}
