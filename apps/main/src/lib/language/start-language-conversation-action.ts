"use server";

import { languageConversationStartInputSchema } from "@zoonk/core/language/conversations/contract";
import { startLanguageConversation } from "@zoonk/core/language/conversations/start";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * A practice call for a unit (1 to 5 minutes), a language goal's checkpoint call, or a goal's IELTS
 * or TOEFL speaking mock.
 */
export type LanguageConversationRequest =
  | { blockId: string; kind: "checkpoint" }
  | { chapterId: string; goalId?: string; kind: "practice"; minutes: number }
  | { goalId: string; kind: "speakingMock" };

/**
 * Starts a call through core and returns its id, or null when it didn't start. Its scenario is
 * written here when it isn't yet, a request the learner makes. The same capability as
 * `POST /v1/language-conversations`; the input is untrusted, so core's schema checks it here.
 */
export async function startLanguageConversationAction(
  request: LanguageConversationRequest,
): Promise<string | null> {
  const input = languageConversationStartInputSchema.safeParse(request);

  if (!input.success) {
    return null;
  }

  const { data, error } = await safeAsync(() => startLanguageConversation(input.data));

  if (error) {
    logError("[startLanguageConversationAction] Failed to start a conversation:", error);
    return null;
  }

  return data.status === "ready" ? data.conversationId : null;
}
