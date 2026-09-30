import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag } from "../../cache/tags";
import { getSession } from "../../users/get-session";
import { type SuggestedGoalView } from "./suggested-goal-contract";

/**
 * The suggested goal Today shows: the learner's most recent course still waiting for an answer.
 * Each one shows until it's answered, and the next one waits its turn.
 */
export async function getCurrentSuggestedGoal(): Promise<SuggestedGoalView | null> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  cacheTag(getGoalsCacheTag(session.user.id));

  return prisma.suggestedGoal.findFirst({
    orderBy: [{ lastActiveAt: "desc" }, { id: "asc" }],
    select: { id: true, status: true, title: true },
    where: { status: "pending", userId: session.user.id },
  });
}
