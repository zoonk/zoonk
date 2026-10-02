"use client";

import { useRouter } from "@/i18n/navigation";
import { useCallback } from "react";
import {
  type LanguageConversationRequest,
  startLanguageConversationAction,
} from "./start-language-conversation-action";

/**
 * Starts a call and opens it on the call screen. Resolves to false when it didn't start, so the
 * screen can say so and offer another try.
 */
export function useStartLanguageConversation() {
  const router = useRouter();

  return useCallback(
    async (request: LanguageConversationRequest): Promise<boolean> => {
      const conversationId = await startLanguageConversationAction(request);

      if (!conversationId) {
        return false;
      }

      router.push(`/conversation/${conversationId}`);
      return true;
    },
    [router],
  );
}
