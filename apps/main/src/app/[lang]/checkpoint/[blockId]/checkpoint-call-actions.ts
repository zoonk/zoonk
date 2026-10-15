"use server";

import { languageConversationStartInputSchema } from "@zoonk/core/language/conversations/contract";
import { getLanguageConversation } from "@zoonk/core/language/conversations/get";
import { startLanguageConversation } from "@zoonk/core/language/conversations/start";

/** The existing Start click creates the conversation and continues into its connection. */
export async function startCheckpointCallAction(blockId: string) {
  const input = languageConversationStartInputSchema.safeParse({ blockId, kind: "checkpoint" });

  if (!input.success) {
    return { status: "failed" } as const;
  }

  const started = await startLanguageConversation(input.data);

  if (started.status === "plusRequired") {
    return { status: "plusRequired" } as const;
  }

  if (started.status !== "ready") {
    return { status: "failed" } as const;
  }

  const view = await getLanguageConversation(started.conversationId);
  return view.status === "ready" ? view : ({ status: "failed" } as const);
}
