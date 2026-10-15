"use server";

import { pronunciationRoundInputSchema } from "@zoonk/core/language/pronunciation/contract";
import { finishPronunciationRound } from "@zoonk/core/language/pronunciation/finish";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/** Counts the round toward the learner's day: the same capability as `POST .../completions`. */
export async function finishPronunciationRoundAction(
  roundId: string,
  input: { goalId: string; timeZone: string },
) {
  const parsed = pronunciationRoundInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const { data, error } = await safeAsync(() =>
    finishPronunciationRound({ input: parsed.data, roundId }),
  );

  if (error) {
    logError("[finishPronunciationRoundAction] Failed to count a round:", error);
    return null;
  }

  return data.status === "ready" ? data.result : null;
}
