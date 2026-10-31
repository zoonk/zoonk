import { pronunciationAnswerFieldsSchema } from "@zoonk/core/language/pronunciation/contract";
import { z } from "zod";

export const pronunciationReviewPathParamsSchema = z
  .object({ reviewId: z.uuid().meta({ description: "Pronunciation review ID" }) })
  .meta({ id: "PronunciationReviewPathParams" });

export const pronunciationRoundPathParamsSchema = z
  .object({
    roundId: z.uuid().meta({ description: "The round's ID, sent with each of its answers" }),
  })
  .meta({ id: "PronunciationRoundPathParams" });

export const pronunciationAnswerRequestSchema = pronunciationAnswerFieldsSchema
  .extend({
    audio: z
      .file()
      .meta({
        description:
          "The recording of the word: WebM (Opus), MP4 or M4A (AAC), MP3 or WAV, up to 2 MB. Never kept.",
      }),
  })
  .meta({ id: "PronunciationAnswerRequest" });
