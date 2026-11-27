import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";

/** Resolves a goal-less Buddy deep link to an owned conversation's goal. */
export async function getBuddyConversationGoalId(conversationId: string): Promise<string | null> {
  "use cache: private";

  const session = await getSession();

  if (!session || !isUuid(conversationId)) {
    return null;
  }

  const userId = session.user.id;

  const thread = await prisma.lessonQuestionThread.findFirst({
    select: { goalId: true },
    where: { goal: { userId }, id: conversationId, kind: "plan", questions: { some: {} }, userId },
  });

  return thread?.goalId ?? null;
}
