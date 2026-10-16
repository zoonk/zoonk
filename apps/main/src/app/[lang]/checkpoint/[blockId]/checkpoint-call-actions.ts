"use server";

import { prepareStudySession } from "@/lib/session/session-preparation";
import { languageConversationStartInputSchema } from "@zoonk/core/language/conversations/contract";
import { getLanguageConversation } from "@zoonk/core/language/conversations/get";
import {
  type StartLanguageConversationResult,
  startLanguageConversation,
} from "@zoonk/core/language/conversations/start";

/**
 * Refusals the page answers differently once it reads the checkpoint again, including today's study
 * time used up since it showed Start: the page then says so, as it does when it opens past the limit.
 */
const CHANGED = new Set<StartLanguageConversationResult["status"]>([
  "blockFinished",
  "dailyLimitReached",
  "earlierFirst",
  "notFound",
  "notLanguage",
  "unauthorized",
]);

/**
 * The existing Start click creates the conversation and continues into its connection. A Start
 * that can't go through says why: Plus lapsed (`plusRequired`), or the checkpoint changed since the
 * page showed it (`changed`: done elsewhere, earlier steps first, today's study time used up, signed
 * out), which the page says once it reads it again. Only `failed` is worth another try.
 */
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

  // A checkpoint's call starts its block: the rest of its day gets written meanwhile, as when
  // Today opens a block.
  if (started.sessionId) {
    prepareStudySession(started.sessionId);
  }

  const view = await getLanguageConversation(started.conversationId);
  return view.status === "ready" ? view : ({ status: "failed" } as const);
}
