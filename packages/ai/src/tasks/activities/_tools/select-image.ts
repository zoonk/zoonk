import { z } from "zod";

export const selectImageInputSchema = z.object({
  options: z
    .array(
      z.object({
        feedback: z.string().describe("Why this image does/doesn't represent the concept"),
        isCorrect: z.boolean(),
        prompt: z
          .string()
          .describe("Image generation prompt describing what to show (not style, just content)"),
      }),
    )
    .describe("2-4 image options"),
  question: z
    .string()
    .describe("A scenario where visual identification demonstrates understanding"),
});
