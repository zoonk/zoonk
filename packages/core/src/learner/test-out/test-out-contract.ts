import { z } from "zod";
import { answerTimeZoneSchema, itemAnswerInputSchema } from "../contract";
import { TEST_OUT_MAX_QUESTIONS } from "./test-out-rules";

export const chapterTestOutInputSchema = z
  .object({
    answers: z.array(itemAnswerInputSchema).min(1).max(TEST_OUT_MAX_QUESTIONS),
    requestId: z
      .uuid()
      .meta({
        description:
          "The test's own id, made when it starts. Sending it again (a retry) returns what it already recorded instead of grading and counting it twice, and `GET .../test-out/results/{requestId}` reads that result back.",
      }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "ChapterTestOutInput" });

export type ChapterTestOutInput = z.infer<typeof chapterTestOutInputSchema>;
