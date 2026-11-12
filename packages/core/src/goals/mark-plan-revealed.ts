import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../cache/tags";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { updateLearningProfile } from "../profile/update-learning-profile";
import { findActiveGoalId } from "./_utils/goal-view";

export type PlanRevealedResult = { status: "notFound" | "ready" | "unauthorized" };

/**
 * Keeps the first time. Today reads the goal again, so it stops answering `preparing`. The goal
 * whose plan the learner starts becomes the one they study, so the step it opens and Today are its.
 */
export async function markPlanRevealed(goalId: string): Promise<PlanRevealedResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return { status: owned.status };
  }

  if (!owned.goal.planRevealedAt) {
    await prisma.goal.updateMany({
      data: { planRevealedAt: new Date() },
      where: { id: goalId, planRevealedAt: null, userId: owned.userId },
    });

    revalidateCacheTags([getGoalsCacheTag(owned.userId)]);
  }

  if ((await findActiveGoalId(owned.userId)) !== goalId) {
    await updateLearningProfile({ activeGoalId: goalId });
  }

  return { status: "ready" };
}
