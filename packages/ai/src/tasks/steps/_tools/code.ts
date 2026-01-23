import { z } from "zod";

export const codeInputSchema = z.object({
  annotations: z
    .array(
      z.object({
        line: z.number().describe("1-based line number"),
        text: z.string().describe("Explanation (max 100 chars)"),
      }),
    )
    .optional()
    .describe("Optional annotations for specific lines"),
  code: z.string().describe("The code snippet (max 500 chars)"),
  language: z.string().describe("Programming language: 'python', 'javascript', 'typescript', etc."),
  stepIndex: z.number().describe("The step index (0-based) this visual is for"),
});
