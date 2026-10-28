import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";

/** A goal's saved plan with its items in plan order, as the planner last wrote them. */
function loadSavedPlan(goalId: string) {
  return prisma.plan.findUnique({
    include: { items: { orderBy: { position: "asc" } } },
    where: { goalId },
  });
}

export type SavedPlan = NonNullable<Awaited<ReturnType<typeof loadSavedPlan>>>;

/**
 * Internal GET fact: the goal's plan read once per request for every view that needs part of it
 * (its settings, graph, phases or items), instead of a query per helper. Tagged with what plan and
 * learner writes expire, so a write's own render reads after it. The caller resolved the goal as
 * the learner's; writes read the plan themselves.
 */
export async function readSavedPlan(userId: string, goalId: string): Promise<SavedPlan | null> {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  return loadSavedPlan(goalId);
}
