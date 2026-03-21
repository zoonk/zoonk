import { z } from "zod";

export const formulaInputSchema = z.object({
  description: z.string().describe("Brief plain-text explanation of the formula (max 100 chars)"),
  formula: z.string().describe("LaTeX math expression"),
  stepIndex: z.number().describe("The step index (0-based) this visual is for"),
});
