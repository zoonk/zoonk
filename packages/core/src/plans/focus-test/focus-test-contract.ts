import { z } from "zod";
import { answerTimeZoneSchema, itemAnswerInputSchema } from "../../learner/contract";
import { FOCUS_TEST_MAX_QUESTIONS } from "./focus-test-rules";

export const focusTestInputSchema = z
  .object({
    answers: z.array(itemAnswerInputSchema).min(1).max(FOCUS_TEST_MAX_QUESTIONS),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "FocusTestInput" });

export type FocusTestInput = z.infer<typeof focusTestInputSchema>;
