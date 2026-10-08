"use server";

import { checkLanguageConversationObjectives } from "@zoonk/core/language/conversations/check-objectives";
import { completeLanguageConversation } from "@zoonk/core/language/conversations/complete";
import { connectLanguageConversation } from "@zoonk/core/language/conversations/connect";
import {
  type LanguageConversationView,
  languageConversationCompletionInputSchema,
  languageConversationObjectiveCheckInputSchema,
} from "@zoonk/core/language/conversations/contract";
import { type ConversationConnection } from "@zoonk/learn/language/conversation";

/**
 * Opens the call: holds its time from the call time on the learner's plan and returns the
 * short-lived token for GPT-Live with how long the call may run.
 * Our gateway key never reaches the browser.
 */
export async function connectConversationAction(
  conversationId: string,
): Promise<ConversationConnection> {
  const result = await connectLanguageConversation(conversationId);

  if (result.status === "ready") {
    return { setup: result.setup, status: "ready" };
  }

  if (result.status === "limitReached") {
    return { limit: { period: result.limit.period, tier: result.limit.tier }, status: "limit" };
  }

  return { status: result.status === "conversationEnded" ? "ended" : "failed" };
}

/** Marks the call's goals from what was said so far; null when the check can't run. */
export async function checkObjectivesAction(
  conversationId: string,
  input: unknown,
): Promise<string[] | null> {
  const parsed = languageConversationObjectiveCheckInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const result = await checkLanguageConversationObjectives({ conversationId, input: parsed.data });
  return result.status === "ready" ? result.objectivesMet : null;
}

/** Saves a finished call; the input is untrusted, so it's parsed with the API's schema. */
export async function completeConversationAction(
  conversationId: string,
  input: unknown,
): Promise<LanguageConversationView | null> {
  const parsed = languageConversationCompletionInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const result = await completeLanguageConversation({ conversationId, input: parsed.data });
  return result.status === "completed" ? result.conversation : null;
}
