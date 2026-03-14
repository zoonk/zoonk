import { z } from "zod";

export const imageInputSchema = z.object({
  prompt: z
    .string()
    .describe(
      "Content description only, not style. Avoid text unless it is necessary for clarity; if text is needed, keep it minimal and spell it exactly in the requested language, including accents and diacritics.",
    ),
  stepIndex: z.number().describe("The step index (0-based) this visual is for"),
});
