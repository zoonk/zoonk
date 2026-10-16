"use server";

import { prepareStudySession } from "@/lib/session/session-preparation";
import { languageConversationStartInputSchema } from "@zoonk/core/language/conversations/contract";
import { startLanguageConversation } from "@zoonk/core/language/conversations/start";
import { type ConversationConnection } from "@zoonk/learn/language/conversation";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * A practice call for a unit (1 to 5 minutes), a language goal's checkpoint call, a goal's IELTS
 * or TOEFL speaking mock, or a task of its DELE, DELF, Goethe or Cambridge speaking paper.
 */
export type LanguageConversationRequest =
  | { blockId: string; kind: "checkpoint" }
  | { chapterId: string; goalId?: string; kind: "practice"; minutes: number }
  | { goalId: string; kind: "speakingMock" }
  | { goalId: string; kind: "examSpeaking"; task: string };

type CallLimit = Extract<ConversationConnection, { status: "limit" }>["limit"];

/** A started call's id, the plan's call time that can't fit an exam task, or null when it failed. */
type StartedLanguageConversation = { conversationId: string } | { limit: CallLimit } | null;

/**
 * Starts a call through core and returns its id, or null when it didn't start. Its scenario is
 * written here when it isn't yet, a request the learner makes. An exam task the call time left
 * can't fit says which period ran short. The same capability as `POST /v1/language-conversations`;
 * the input is untrusted, so core's schema checks it here.
 */
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

  // A checkpoint's call starts its block: the rest of its day gets written meanwhile, as when
  // Today opens a block.
  if (data.sessionId) {
    prepareStudySession(data.sessionId);
  }

  return { conversationId: data.conversationId };
}
