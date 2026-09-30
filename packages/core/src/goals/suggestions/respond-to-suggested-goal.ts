import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../cache/tags";
import { getSession } from "../../users/get-session";
import { type SuggestedGoalAnswerInput, type SuggestedGoalView } from "./suggested-goal-contract";

export type SuggestedGoalAnswerResult =
  | { status: "updated"; suggestedGoal: SuggestedGoalView }
  | { status: "alreadyAnswered" | "notFound" | "unauthorized" };

/**
 * The learner's answer to a suggested goal on Today. Accepting only records the answer: the apps
 * then open onboarding with the course's title, where the goal is really made. Each suggestion is
 * answered once.
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

  const { count } = await prisma.suggestedGoal.updateMany({
    data: { respondedAt: new Date(), status: input.status },
    where: { id: suggestionId, status: "pending", userId },
  });

  const suggestion = await prisma.suggestedGoal.findFirst({
    select: { id: true, status: true, title: true },
    where: { id: suggestionId, userId },
  });

  if (!suggestion) {
    return { status: "notFound" };
  }

  if (count === 0) {
    return { status: "alreadyAnswered" };
  }

  revalidateCacheTags([getGoalsCacheTag(userId)]);

  return { status: "updated", suggestedGoal: suggestion };
}
