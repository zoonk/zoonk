"use server";

import { routing } from "@/i18n/routing";
import { postAsLearner } from "@/lib/api/learner-api";
import {
  type CompletedLanguageConversation,
  completedLanguageConversationSchema,
  languageConversationCompletionInputSchema,
  languageConversationObjectiveCheckInputSchema,
  languageConversationObjectiveCheckSchema,
  languageConversationSetupSchema,
} from "@zoonk/core/language/conversations/contract";
import { type ConversationConnection } from "@zoonk/learn/language/conversation";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { readConnectionRefusal } from "./connection-refusal";

/** Reserves through the API so every transport has a durable deadline receipt before SDP. */
export async function connectConversationAction({
  conversationId,
  input,
  locale,
}: {
  conversationId: string;
  input?: { takeover?: boolean };
  locale: string;
}): Promise<ConversationConnection> {
  if (!hasLocale(routing.locales, locale)) {
    return { status: "failed" };
  }

  const response = await postAsLearner({
    body: input ?? {},
    path: `/v1/language-conversations/${conversationId}/connections`,
  });

  if (!response.ok) {
    return readConnectionRefusal(response.json);
  }

  const setup = languageConversationSetupSchema.safeParse(response.json);

  if (!setup.success) {
    return { status: "failed" };
  }

  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;

  return {
    setup: {
      ...setup.data,
      sessionUrl: `${prefix}/conversation/${conversationId}/live-session/${setup.data.connectionId}`,
    },
    status: "ready",
  };
}

/** An uncertain hangup stays retryable. */
export async function endConversationConnectionAction(
  conversationId: string,
  connectionId: string,
) {
  const response = await postAsLearner({
    path: `/v1/language-conversations/${conversationId}/connections/${connectionId}/end`,
  });

  if (response.ok) {
    return {
      endedAtDeadline: getString(response.json, "endReason") === "deadline",
      status: "closed",
    } as const;
  }

  const refusal = readConnectionRefusal(response.json);

  return {
    status: refusal.status === "previousConnectionClosing" ? refusal.status : "failed",
  } as const;
}

export async function checkObjectivesAction(
  conversationId: string,
  input: unknown,
): Promise<string[] | null> {
  const parsed = languageConversationObjectiveCheckInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const response = await postAsLearner({
    body: parsed.data,
    path: `/v1/language-conversations/${conversationId}/objective-checks`,
  });

  const result = response.ok
    ? languageConversationObjectiveCheckSchema.safeParse(response.json)
    : null;

  return result?.success ? result.data.objectivesMet : null;
}

export async function completeConversationAction(
  conversationId: string,
  input: unknown,
): Promise<
  | { conversation: CompletedLanguageConversation; status: "completed" }
  | { status: "ended" | "failed" | "takenOver" }
> {
  const parsed = languageConversationCompletionInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "failed" };
  }

  const response = await postAsLearner({
    body: parsed.data,
    path: `/v1/language-conversations/${conversationId}/completions`,
  });

  if (!response.ok) {
    const error = isJsonObject(response.json) ? response.json.error : null;
    const code = getString(error, "code");

    if (code === "CALL_TAKEN_OVER") {
      return { status: "takenOver" };
    }

    if (code === "CONVERSATION_ENDED") {
      return { status: "ended" };
    }

    return { status: "failed" };
  }

  const result = completedLanguageConversationSchema.safeParse(response.json);

  if (!result.success) {
    return { status: "failed" };
  }

  // API cache invalidation cannot refresh Main's retained exam, unit, allowance and progress views.
  revalidatePath("/[lang]", "layout");
  return { conversation: result.data, status: "completed" };
}
