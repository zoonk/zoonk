import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../cache/tags";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSession } from "../../users/get-session";
import { suggestedGoalViewSelect, toSuggestedGoalView } from "./_utils/suggested-goal-view";
import { type SuggestedGoalAnswerInput, type SuggestedGoalView } from "./suggested-goal-contract";

export type SuggestedGoalAnswerResult =
  | { status: "updated"; suggestedGoal: SuggestedGoalView }
  | { status: "alreadyAnswered" | "notFound" | "unauthorized" };

/**
 * The learner's answer to a suggested goal on Today. Accepting only records the answer: the apps
 * then open the course's start (or onboarding with its title, once nobody can start the course),
 * where the goal is really made. Each suggestion is answered once.
 */
export async function respondToSuggestedGoal({
  input,
  suggestionId,
}: {
  input: SuggestedGoalAnswerInput;
  suggestionId: string;
}): Promise<SuggestedGoalAnswerResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(suggestionId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;

  const count = await writeLearnerChange({ userId }, async (tx) => {
    const saved = await tx.suggestedGoal.updateMany({
      data: { respondedAt: new Date(), status: input.status },
      where: { id: suggestionId, status: "pending", userId },
    });

    return saved.count === 0 ? unchanged(0) : saved.count;
  });

  const suggestion = await prisma.suggestedGoal.findFirst({
    select: suggestedGoalViewSelect,
    where: { id: suggestionId, userId },
  });

  if (!suggestion) {
    return { status: "notFound" };
  }

  if (count === 0) {
    return { status: "alreadyAnswered" };
  }

  revalidateCacheTags([getGoalsCacheTag(userId)]);

  return { status: "updated", suggestedGoal: await toSuggestedGoalView(suggestion) };
}
