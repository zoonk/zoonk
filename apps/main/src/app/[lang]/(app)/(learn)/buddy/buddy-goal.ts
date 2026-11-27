import "server-only";
import { getActiveGoalId } from "@zoonk/core/goals/active-goal";
import { getOwnedGoal } from "@zoonk/core/goals/owned-goal";
import { getLessonQuestionThread } from "@zoonk/core/lesson-questions/get-thread";
import { getSession } from "@zoonk/core/users/session";

export async function findBuddyGoal() {
  const goalId = await getActiveGoalId();

  if (!goalId) {
    return null;
  }

  const owned = await getOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return null;
  }

  const { goal } = owned;
  return goal.status !== "archived" && goal.kind !== "explain" ? goal : null;
}

export async function canAskBuddy(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session && !session.user.isAnonymous);
}

export async function readBuddyConversation({
  conversationId,
  goalId,
}: {
  conversationId: string;
  goalId: string;
}) {
  const result = await getLessonQuestionThread({
    target: { conversationId, goalId, kind: "plan" },
  });

  if (result.status !== "ready" || !result.thread) {
    return null;
  }

  const { hasMore, nextCursor, questions } = result.thread;
  return { hasMore, nextCursor, questions };
}
