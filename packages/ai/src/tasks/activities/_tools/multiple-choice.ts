import { z } from "zod";

export const multipleChoiceInputSchema = z.object({
  context: z
    .string()
    .describe(
      "A novel real-world scenario that sets up the question (max 300 chars). " +
        "Write it as if describing a situation to a friend. " +
        "For code-related topics, include short code snippets inline.",
    ),
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
