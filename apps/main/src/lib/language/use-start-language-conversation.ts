"use client";

import { useRouter } from "@/i18n/navigation";
import { type ConversationConnection } from "@zoonk/learn/language/conversation";
import { useStillOnPage } from "@zoonk/ui/hooks/still-here";
import { useCallback } from "react";
import {
  type LanguageConversationRequest,
  startLanguageConversationAction,
} from "./start-language-conversation-action";

type CallLimit = Extract<ConversationConnection, { status: "limit" }>["limit"];

type OpenedCall = boolean | "paused" | { generationId: string };

export function useOpenLanguageConversation({ from }: { from?: "exam" } = {}) {
  const router = useRouter();
  const stillOnPage = useStillOnPage();

  return useCallback(
    async (request: LanguageConversationRequest): Promise<OpenedCall | { limit: CallLimit }> => {
      const isStillHere = stillOnPage();
      const started = await startLanguageConversationAction(request);

      if (!started) {
        return false;
      }

      if (started === "paused" || "limit" in started || "generationId" in started) {
        return started;
      }

      if (isStillHere()) {
        router.push(`/conversation/${started.conversationId}${from ? `?from=${from}` : ""}`);
      }

      return true;
    },
    [from, router, stillOnPage],
  );
}

export function useStartLanguageConversation(options: { from?: "exam" } = {}) {
  const open = useOpenLanguageConversation(options);

  return useCallback(
    async (request: LanguageConversationRequest): Promise<OpenedCall> => {
      const opened = await open(request);
      return typeof opened === "object" && "limit" in opened ? false : opened;
    },
    [open],
  );
}
