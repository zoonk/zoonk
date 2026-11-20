"use client";

import { useRouter } from "@/i18n/navigation";
import { answerHere, openingHere } from "@/lib/session/tap-answer";
import { type ConversationConnection } from "@zoonk/learn/language/conversation";
import { useCallback } from "react";
import {
  type LanguageConversationRequest,
  startLanguageConversationAction,
} from "./start-language-conversation-action";

type CallLimit = Extract<ConversationConnection, { status: "limit" }>["limit"];

type OpenedCall = boolean | "paused" | { generationId: string };

export function useOpenLanguageConversation({ from }: { from?: "exam" } = {}) {
  const router = useRouter();

  return useCallback(
    async (request: LanguageConversationRequest): Promise<OpenedCall | { limit: CallLimit }> => {
      const answered = await answerHere(startLanguageConversationAction(request), openingHere());

      if (typeof answered === "string") {
        return answered === "left";
      }

      const started = answered.answer;

      if (!started) {
        return false;
      }

      if (started === "paused" || "limit" in started || "generationId" in started) {
        return started;
      }

      router.push(`/conversation/${started.conversationId}${from ? `?from=${from}` : ""}`);
      return true;
    },
    [from, router],
  );
}
