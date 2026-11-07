import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { answerTimeZoneSchema, itemAnswerInputSchema } from "../../learner/contract";
import { FOCUS_TEST_MAX_QUESTIONS } from "./focus-test-rules";

export const focusTestInputSchema = z
  .object({
    answers: z.array(itemAnswerInputSchema).min(1).max(FOCUS_TEST_MAX_QUESTIONS),
    requestId: uuidSchema().meta({
      description:
        "The test's own id, made when it's first sent. Sending it again (a retry) returns what it already recorded instead of grading and counting it twice.",
    }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "FocusTestInput" });

export type FocusTestInput = z.infer<typeof focusTestInputSchema>;
