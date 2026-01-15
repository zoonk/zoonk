import { z } from "zod";

export const matchColumnsInputSchema = z.object({
  pairs: z
    .array(
      z.object({
        left: z.string().describe("Real-world item, scenario, or phenomenon"),
        right: z
          .string()
          .describe("The concept, principle, or outcome it connects to"),
      }),
    )
    .describe("3-5 pairs to match"),
  question: z.string().describe("Context for the matching task"),
});
