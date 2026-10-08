"use server";

import { answerPronunciationReview } from "@zoonk/core/language/pronunciation/answer";
import {
  pronunciationAnswerFieldsSchema,
  pronunciationRoundInputSchema,
} from "@zoonk/core/language/pronunciation/contract";
import { finishPronunciationRound } from "@zoonk/core/language/pronunciation/finish";
import { type PronunciationAnswerOutcome } from "@zoonk/learn/language/pronunciation";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";

const reviewIdSchema = z.uuid();

function readField(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

/**
 * Grades one recorded review word through the same core capability as
 * `POST /v1/pronunciation-reviews/{reviewId}/answers`: the `audio` blob with `reviewId`,
 * `roundId`, `durationMs` and `timeZone` fields.
 */
export async function answerPronunciationAction(
  form: FormData,
): Promise<PronunciationAnswerOutcome> {
  const audio = form.get("audio");
  const reviewId = reviewIdSchema.safeParse(form.get("reviewId"));

  const fields = pronunciationAnswerFieldsSchema.safeParse({
    durationMs: readField(form, "durationMs"),
    roundId: readField(form, "roundId"),
    timeZone: readField(form, "timeZone"),
  });

  if (!(audio instanceof Blob) || !reviewId.success || !fields.success) {
    return { status: "failed" };
  }

  const { data: result, error } = await safeAsync(async () =>
    answerPronunciationReview({
      audio: { bytes: new Uint8Array(await audio.arrayBuffer()), mediaType: audio.type },
      fields: fields.data,
      reviewId: reviewId.data,
    }),
  );

  if (error) {
    logError("[answerPronunciationAction] Failed to grade a review word:", error);
    return { status: "failed" };
  }

  if (result.status === "graded" || result.status === "noSpeech") {
    return result;
  }

  return { status: "failed" };
}

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
