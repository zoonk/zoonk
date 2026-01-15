import { z } from "zod";

import { contextSchema } from "./shared";

export const multipleChoiceInputSchema = z.object({
  context: contextSchema,
  options: z
    .array(
      z.object({
        feedback: z
          .string()
          .describe(
            "Why this is right (with insight) or wrong (and why correct is right)",
          ),
        isCorrect: z.boolean(),
        text: z.string().describe("The answer choice"),
      }),
    )
    .describe("Exactly 4 options: 1 correct, 3 plausible distractors"),
  question: z
    .string()
    .describe("Short question about the context (max 50 chars)"),
});
