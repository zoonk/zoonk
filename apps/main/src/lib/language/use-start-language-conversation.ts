"use client";

import { useRouter } from "@/i18n/navigation";
import { type ConversationConnection } from "@zoonk/learn/language/conversation";
import { useCallback } from "react";
import {
  type LanguageConversationRequest,
  startLanguageConversationAction,
} from "./start-language-conversation-action";

type CallLimit = Extract<ConversationConnection, { status: "limit" }>["limit"];

export function useOpenLanguageConversation({ from }: { from?: "exam" } = {}) {
  const router = useRouter();

  return useCallback(
    async (
      request: LanguageConversationRequest,
    ): Promise<boolean | "paused" | { limit: CallLimit }> => {
      const started = await startLanguageConversationAction(request);

      if (!started) {
        return false;
      }

      if (started === "paused" || "limit" in started) {
        return started;
      }

      router.push(`/conversation/${started.conversationId}${from ? `?from=${from}` : ""}`);
      return true;
    },
    [from, router],
  );
}

export function useStartLanguageConversation(options: { from?: "exam" } = {}) {
  const open = useOpenLanguageConversation(options);

  return useCallback(
    async (request: LanguageConversationRequest): Promise<boolean | "paused"> => {
      const opened = await open(request);
      return opened === "paused" ? opened : opened === true;
    },
    [open],
  );
}
