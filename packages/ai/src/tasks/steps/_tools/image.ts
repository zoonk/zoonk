import { z } from "zod";

export const imageInputSchema = z.object({
  prompt: z.string().describe("Content description only, not style"),
  stepIndex: z.number().describe("The step index (0-based) this visual is for"),
});
