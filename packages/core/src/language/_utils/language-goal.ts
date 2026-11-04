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
  activeGoalId,
  goalId,
  targetLanguage,
  userId,
}: {
  activeGoalId?: string | null;
  goalId?: string;
  targetLanguage: string;
  userId: string;
}): Promise<Goal | null> {
  const [goals, chosenId] = await Promise.all([
    prisma.goal.findMany({
      orderBy: { updatedAt: "desc" },
      where: { kind: "language", targetLanguage, userId },
    }),
    activeGoalId === undefined ? findActiveGoalId(userId) : activeGoalId,
  ]);

  const [preferred] = [goalId, chosenId].flatMap(
    (id) => goals.find((goal) => goal.id === id) ?? [],
  );

  return preferred ?? goals.find((goal) => goal.status === "active") ?? goals[0] ?? null;
}
