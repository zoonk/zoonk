import { z } from "zod";
import { answerTimeZoneSchema, itemAnswerInputSchema } from "../contract";
import { TEST_OUT_MAX_QUESTIONS } from "./test-out-rules";

export const chapterTestOutInputSchema = z
  .object({
    answers: z.array(itemAnswerInputSchema).min(1).max(TEST_OUT_MAX_QUESTIONS),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "ChapterTestOutInput" });

export type ChapterTestOutInput = z.infer<typeof chapterTestOutInputSchema>;
