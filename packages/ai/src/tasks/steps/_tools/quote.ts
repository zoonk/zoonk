import { z } from "zod";

export const quoteInputSchema = z.object({
  author: z.string().describe("Attribution: 'Name, Year' or 'Name'"),
  stepIndex: z.number().describe("The step index (0-based) this visual is for"),
  text: z.string().describe("The quote (max 500 chars)"),
});
