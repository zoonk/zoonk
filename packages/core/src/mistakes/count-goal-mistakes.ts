import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag } from "../cache/tags";
import { getOwnedGoal } from "../learner/get-owned-goal";
import { getScopeSkillIds } from "./_utils/mistake-scope";

async function loadGoalScope(goalId: string) {
  const owned = await getOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  cacheTag(getLearnerModelCacheTag(owned.userId));
  const skillIds = await getScopeSkillIds({ goalId });

  return { ...owned, skillIds };
}

type ScopeFailure = Exclude<Awaited<ReturnType<typeof loadGoalScope>>, { status: "ready" }>;

/** Counts unavailable practice too, not only mistakes currently ready to drill. */
export async function countOpenGoalMistakes(input: {
  goalId: string;
}): Promise<ScopeFailure | { open: number; status: "ready" }> {
  "use cache: private";

  const scope = await loadGoalScope(input.goalId);

  if (scope.status !== "ready") {
    return scope;
  }

  const open = await prisma.mistake.count({
    where: {
      status: "open",
      userId: scope.userId,
      ...(scope.skillIds ? { skillId: { in: scope.skillIds } } : {}),
    },
  });

  return { open, status: "ready" };
}
