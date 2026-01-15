import { z } from "zod";

export const fillBlankInputSchema = z.object({
  answers: z
    .array(z.string())
    .describe("Correct words in order (position 0 fills first blank)"),
  distractors: z
    .array(z.string())
    .describe("Plausible but incorrect words to include as options"),
  feedback: z
    .string()
    .describe("Explanation of why these concepts belong in these positions"),
  question: z.string().describe("Context for the fill-in-the-blank exercise"),
  template: z
    .string()
    .describe("Sentence(s) with [BLANK] placeholders - use exactly [BLANK]"),
});
