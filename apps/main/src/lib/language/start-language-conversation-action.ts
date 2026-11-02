"use server";

import { postAsLearner } from "@/lib/api/learner-api";
import { languageConversationStartInputSchema } from "@zoonk/core/language/conversations/contract";
import { z } from "zod";

export type LanguageConversationRequest =
  | { blockId: string; kind: "checkpoint" }
  | { chapterId: string; goalId?: string; kind: "practice"; minutes: number }
  | { goalId: string; kind: "speakingMock" }
  | { goalId: string; kind: "examSpeaking"; task: string };

const startedSchema = z.object({ conversationId: z.string() });

const writingSchema = z.object({ generationId: z.string() });

const limitSchema = z.object({
  error: z.object({
    code: z.literal("CONVERSATION_LIMIT_REACHED"),
    details: z.object({
      period: z.enum(["day", "month", "total"]),
      tier: z.enum(["free", "guest", "plus"]),
    }),
  }),
});

const pausedSchema = z.object({ error: z.object({ code: z.literal("CALLS_PAUSED") }) });

type StartedLanguageConversation =
  | z.infer<typeof startedSchema>
  | z.infer<typeof writingSchema>
  | { limit: z.infer<typeof limitSchema>["error"]["details"] }
  | "paused"
  | null;

/** The API starts the run writing a call that isn't written yet, so the start goes through it. */
export async function startLanguageConversationAction(
  request: LanguageConversationRequest,
): Promise<StartedLanguageConversation> {
  const input = languageConversationStartInputSchema.safeParse(request);

  if (!input.success) {
    return null;
  }

  const response = await postAsLearner({ body: input.data, path: "/v1/language-conversations" });

  if (response.ok) {
    return (
      startedSchema.safeParse(response.json).data ??
      writingSchema.safeParse(response.json).data ??
      null
    );
  }

  const limit = limitSchema.safeParse(response.json).data?.error.details;

  if (limit) {
    return { limit };
  }

  return pausedSchema.safeParse(response.json).success ? "paused" : null;
}
