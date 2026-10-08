"use client";

import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { type ConversationActions, ConversationScreen } from "@zoonk/learn/language/conversation";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";
import {
  checkObjectivesAction,
  completeConversationAction,
  connectConversationAction,
} from "./conversation-actions";

/**
 * Where a call leads: a checkpoint back to today's session, which opens the next block; practice
 * back to its unit; a speaking mock to the Journey, where it starts.
 */
function getHrefs(conversation: LanguageConversationView) {
  if (conversation.kind === "checkpoint") {
    return { exit: "/today", next: "/session" };
  }

  if (conversation.unit) {
    const unit = `/content/units/${conversation.unit.chapterId}`;
    return { exit: unit, next: unit };
  }

  return { exit: "/journey", next: "/journey" };
}

/** Wires the call screen to the app: opening the call, its goals, saving it, and another mock. */
export function ConversationClient({ conversation }: { conversation: LanguageConversationView }) {
  const startConversation = useStartLanguageConversation();
  const { goalId, id, kind } = conversation;

  const actions = useMemo<ConversationActions>(
    () => ({
      checkObjectives: (turns) => checkObjectivesAction(id, { turns }),
      complete: (input) =>
        completeConversationAction(id, { ...input, timeZone: getLocalTimeZone() }),
      connect: () => connectConversationAction(id),
      ...(kind === "speakingMock" && goalId
        ? {
            startAgain: async () => {
              await startConversation({ goalId, kind: "speakingMock" });
            },
          }
        : {}),
    }),
    [goalId, id, kind, startConversation],
  );

  return (
    <ConversationScreen
      actions={actions}
      conversation={conversation}
      hrefs={getHrefs(conversation)}
    />
  );
}
