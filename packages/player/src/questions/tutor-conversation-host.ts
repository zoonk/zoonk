"use client";

import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { createContext, use } from "react";

/** `blank`: made here and not sent yet, so there is nothing of it to load. */
export type OpenConversation = { blank: boolean; id: string };

type ConversationHost = OpenConversation & { missionMoment: MissionMomentView | null };

export const ConversationHostContext = createContext<ConversationHost | null>(null);

export function useConversationHost(): ConversationHost {
  const host = use(ConversationHostContext);

  if (!host) {
    throw new Error("TutorConversationLog must be used inside TutorConversationHost");
  }

  return host;
}
