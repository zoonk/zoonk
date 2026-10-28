"use server";

import { prepareStudySession } from "@/lib/session/session-preparation";
import { languageConversationStartInputSchema } from "@zoonk/core/language/conversations/contract";
import { getLanguageConversation } from "@zoonk/core/language/conversations/get";
import {
  type StartLanguageConversationResult,
  startLanguageConversation,
} from "@zoonk/core/language/conversations/start";

const CHANGED = new Set<StartLanguageConversationResult["status"]>([
  "blockFinished",
  "dailyLimitReached",
  "earlierFirst",
  "notFound",
  "notLanguage",
  "unauthorized",
]);

/** Only `failed` is worth another try. */
export async function startCheckpointCallAction(blockId: string) {
  const input = languageConversationStartInputSchema.safeParse({ blockId, kind: "checkpoint" });

  if (!input.success) {
    return { status: "failed" } as const;
  }

  const started = await startLanguageConversation(input.data);

  if (started.status === "plusRequired") {
    return { status: started.status } as const;
  }

  if (CHANGED.has(started.status)) {
    return { status: "changed" } as const;
  }

  if (started.status !== "ready") {
    return { status: "failed" } as const;
  }

  if (started.sessionId) {
    prepareStudySession(started.sessionId);
  }

  const view = await getLanguageConversation(started.conversationId);
  return view.status === "ready" ? view : ({ status: "failed" } as const);
}
