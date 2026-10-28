"use server";

import { prepareStudySession } from "@/lib/session/session-preparation";
import { languageConversationStartInputSchema } from "@zoonk/core/language/conversations/contract";
import { startLanguageConversation } from "@zoonk/core/language/conversations/start";
import { type ConversationConnection } from "@zoonk/learn/language/conversation";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

export type LanguageConversationRequest =
  | { blockId: string; kind: "checkpoint" }
  | { chapterId: string; goalId?: string; kind: "practice"; minutes: number }
  | { goalId: string; kind: "speakingMock" }
  | { goalId: string; kind: "examSpeaking"; task: string };

type CallLimit = Extract<ConversationConnection, { status: "limit" }>["limit"];

type StartedLanguageConversation = { conversationId: string } | { limit: CallLimit } | null;

export async function startLanguageConversationAction(
  request: LanguageConversationRequest,
): Promise<StartedLanguageConversation> {
  const input = languageConversationStartInputSchema.safeParse(request);

  if (!input.success) {
    return null;
  }

  const { data, error } = await safeAsync(() => startLanguageConversation(input.data));

  if (error) {
    logError("[startLanguageConversationAction] Failed to start a conversation:", error);
    return null;
  }

  if (data.status === "limitReached") {
    return { limit: { period: data.limit.period, tier: data.limit.tier } };
  }

  if (data.status !== "ready") {
    return null;
  }

  if (data.sessionId) {
    prepareStudySession(data.sessionId);
  }

  return { conversationId: data.conversationId };
}
