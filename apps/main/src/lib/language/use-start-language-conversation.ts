"use client";

import { useRouter } from "@/i18n/navigation";
import { type ConversationConnection } from "@zoonk/learn/language/conversation";
import { useCallback } from "react";
import {
  type LanguageConversationRequest,
  startLanguageConversationAction,
} from "./start-language-conversation-action";

type CallLimit = Extract<ConversationConnection, { status: "limit" }>["limit"];

/**
 * Starts a call and opens it on the call screen. Resolves to true once it opens, false when it
 * didn't start, so the screen can say so and offer another try, or, for an exam task the call time
 * left can't fit, that call time (`limit`). A call started from the exam screen (`from: "exam"`)
 * leads back there when it's done.
 */
export function useOpenLanguageConversation({ from }: { from?: "exam" } = {}) {
  const router = useRouter();

  return useCallback(
    async (request: LanguageConversationRequest): Promise<boolean | { limit: CallLimit }> => {
      const started = await startLanguageConversationAction(request);

      if (!started) {
        return false;
      }

      if ("limit" in started) {
        return started;
      }

      router.push(`/conversation/${started.conversationId}${from ? `?from=${from}` : ""}`);
      return true;
    },
    [from, router],
  );
}

/** Starts a call and opens it, as `useOpenLanguageConversation`; false whenever it didn't start. */
export function useStartLanguageConversation(options: { from?: "exam" } = {}) {
  const open = useOpenLanguageConversation(options);

  return useCallback(
    async (request: LanguageConversationRequest) => (await open(request)) === true,
    [open],
  );
}
