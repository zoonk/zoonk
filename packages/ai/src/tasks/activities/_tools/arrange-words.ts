import { z } from "zod";

export const arrangeWordsInputSchema = z.object({
  distractors: z
    .array(z.string())
    .describe("Plausible but incorrect words in the target language only"),
  feedback: z
    .string()
    .describe("Explanation of why this arrangement is correct"),
  question: z
    .string()
    .describe(
      "Contextual question requiring understanding to answer (NOT just 'arrange these words')",
    ),
  words: z
    .array(z.string())
    .describe(
      "Words in the CORRECT order. Each must be a single word in the target language — no mixed scripts",
    ),
});
