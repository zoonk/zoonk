import "server-only";
import { prisma } from "@zoonk/db";

/**
 * Whether the learner has a goal with a plan to study: any goal but a quick explanation, paused
 * ones included. A learner with only explanations has no day to plan, so they ask the next
 * question instead.
 */
export async function hasStudyGoal(userId: string): Promise<boolean> {
  const goal = await prisma.goal.findFirst({
    select: { id: true },
    where: { kind: { not: "explain" }, status: { not: "archived" }, userId },
  });

  return goal !== null;
}
