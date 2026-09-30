"use server";

import {
  type GenerationWaitInput,
  generationWaitInputSchema,
} from "@zoonk/core/lookahead/contract";
import { recordGenerationWait } from "@zoonk/core/lookahead/record-generation-wait";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * Reports how long the learner waited for content to be written (a lesson, a quick explanation or
 * a new goal's plan), from the first waiting screen: the same core capability as
 * `POST /v1/me/generation-waits`. Best effort: a lost measurement never blocks what was waited for.
 */
export async function recordGenerationWaitAction(input: {
  contentKind: Exclude<GenerationWaitInput["contentKind"], "variant">;
  locale?: string;
  milliseconds: number;
}): Promise<void> {
  const parsed = generationWaitInputSchema.safeParse({
    contentKind: input.contentKind,
    locale: input.locale,
    milliseconds: Math.round(input.milliseconds),
    platform: "web",
  });

  if (!parsed.success) {
    return;
  }

  const { error } = await safeAsync(() => recordGenerationWait(parsed.data));

  if (error) {
    logError("[recordGenerationWaitAction] Failed to record a generation wait:", error);
  }
}
