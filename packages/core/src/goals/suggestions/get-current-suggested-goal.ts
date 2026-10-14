import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag } from "../../cache/tags";
import { getSession } from "../../users/get-session";
import { suggestedGoalViewSelect, toSuggestedGoalView } from "./_utils/suggested-goal-view";
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

  const suggestion = await prisma.suggestedGoal.findFirst({
    orderBy: [{ lastActiveAt: "desc" }, { id: "asc" }],
    select: suggestedGoalViewSelect,
    where: { status: "pending", userId: session.user.id },
  });

  return suggestion && toSuggestedGoalView(suggestion);
}
