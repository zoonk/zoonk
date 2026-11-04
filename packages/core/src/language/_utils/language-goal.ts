import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { findActiveGoalId } from "../../goals/_utils/goal-view";

export function readGoalDetails(goal: Pick<Goal, "details"> | null): Record<string, unknown> {
  return goal && isJsonObject(goal.details) ? goal.details : {};
}

/**
 * A supplied goal must belong to the learner; otherwise the goal they chose, when it's for the
 * language, then their latest active or latest goal for it. GET reads pass the chosen goal they
 * loaded with `readActiveGoal` (null for none); writes leave it out and it's read fresh.
 */
export async function findLearnerLanguageGoal({
  activeGoal,
  goalId,
  targetLanguage,
  userId,
}: {
  activeGoal?: Goal | null;
  goalId?: string;
  targetLanguage: string;
  userId: string;
}): Promise<Goal | null> {
  if (
    activeGoal?.kind === "language" &&
    activeGoal.targetLanguage === targetLanguage &&
    (!goalId || goalId === activeGoal.id)
  ) {
    return activeGoal;
  }

  const [goals, activeGoalId] = await Promise.all([
    prisma.goal.findMany({
      orderBy: { updatedAt: "desc" },
      where: { kind: "language", targetLanguage, userId },
    }),
    activeGoal === undefined ? findActiveGoalId(userId) : (activeGoal?.id ?? null),
  ]);

  const [preferred] = [goalId, activeGoalId].flatMap(
    (id) => goals.find((goal) => goal.id === id) ?? [],
  );

  return preferred ?? goals.find((goal) => goal.status === "active") ?? goals[0] ?? null;
}
