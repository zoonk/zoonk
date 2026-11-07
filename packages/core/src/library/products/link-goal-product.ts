import "server-only";
import { prisma } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";

export type GoalProductLink = { productId: string; productReleaseId: string | null };

/**
 * Internal workflow bridge for research: the goal must come from the run researching it. Records
 * that research decided, so the skill graph stops waiting; `null` links nothing and keeps an
 * earlier link. A goal reaches its product's pages through `productId`, not `LearnerSource` rows,
 * which hold one row per learner and page whatever the goal.
 */
export async function linkGoalToProduct({
  goalId,
  link,
}: {
  goalId: string;
  link: GoalProductLink | null;
}): Promise<boolean> {
  const goal = await prisma.goal.findUnique({ select: { userId: true }, where: { id: goalId } });

  if (!goal) {
    return false;
  }

  return writeLearnerChange({ goalIds: [goalId], userId: goal.userId }, async (tx) => {
    const { count } = await tx.goal.updateMany({
      data: { productCheckedAt: new Date(), ...link },
      where: { id: goalId },
    });

    return count > 0 ? true : unchanged(false);
  });
}
