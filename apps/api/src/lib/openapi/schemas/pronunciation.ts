import { pronunciationAnswerFieldsSchema } from "@zoonk/core/language/pronunciation/contract";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const pronunciationReviewPathParamsSchema = z
  .object({ reviewId: uuidSchema().meta({ description: "Pronunciation review ID" }) })
  .meta({ id: "PronunciationReviewPathParams" });

export const pronunciationRoundPathParamsSchema = z
  .object({
    roundId: uuidSchema().meta({ description: "The round's ID, sent with each of its answers" }),
  })
  .meta({ id: "PronunciationRoundPathParams" });

export const pronunciationAnswerRequestSchema = pronunciationAnswerFieldsSchema
  .extend({
    audio: z
      .file()
      .meta({
        description:
          "The recording of the word: WebM (Opus) or MP4 and M4A (AAC), up to 2 MB and a minute. Never kept.",
      }),
  })
  .meta({ id: "PronunciationAnswerRequest" });
