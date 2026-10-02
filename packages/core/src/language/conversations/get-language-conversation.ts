import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { readBlockPayload } from "../../sessions/block-payload";
import { getSession } from "../../users/get-session";
import { type ConversationRow, toConversationView } from "./_utils/conversation-view";
import { type LanguageConversationView } from "./conversation-contract";

export type OwnedConversation = { bossKind: "boss" | "finalBoss"; row: ConversationRow };

/** One of the learner's calls, with the boss kind its checkpoint block holds. */
export async function findOwnedConversation({
  conversationId,
  userId,
}: {
  conversationId: string;
  userId: string;
}): Promise<OwnedConversation | null> {
  if (!isUuid(conversationId)) {
    return null;
  }

  const found = await prisma.languageConversation.findFirst({
    include: { chapter: { select: { id: true, title: true } }, studyBlock: true },
    where: { id: conversationId, userId },
  });

  if (!found) {
    return null;
  }

  const { studyBlock, ...row } = found;
  const checkpoint = studyBlock ? readBlockPayload(studyBlock).checkpoint : null;

  return { bossKind: checkpoint?.kind === "finalBoss" ? "finalBoss" : "boss", row };
}

export type LanguageConversationResult =
  | { conversation: LanguageConversationView; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/**
 * One of the learner's live conversations: before the call, what it's about and what the voice
 * model is told; after it, the result and feedback. Another learner's call is "not found".
 */
export async function getLanguageConversation(
  conversationId: string,
): Promise<LanguageConversationResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const owned = await findOwnedConversation({ conversationId, userId: session.user.id });
  const conversation = owned ? toConversationView(owned) : null;

  return conversation ? { conversation, status: "ready" } : { status: "notFound" };
}
