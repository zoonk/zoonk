import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../cache/tags";
import { findOwnedGoal } from "../learner/_utils/owned-goal";

export type PlanRevealedResult = { status: "notFound" | "ready" | "unauthorized" };

/** Keeps the first time. Today reads the goal again, so it stops answering `preparing`. */
export async function markPlanRevealed(goalId: string): Promise<PlanRevealedResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return { status: owned.status };
  }

  if (owned.goal.planRevealedAt) {
    return { status: "ready" };
  }

  await prisma.goal.updateMany({
    data: { planRevealedAt: new Date() },
    where: { id: goalId, planRevealedAt: null, userId: owned.userId },
  });

  revalidateCacheTags([getGoalsCacheTag(owned.userId)]);
  return { status: "ready" };
}
