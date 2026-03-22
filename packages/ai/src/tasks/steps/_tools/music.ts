import { z } from "zod";

export const musicInputSchema = z.object({
  abc: z.string().describe("ABC notation string including headers (X:, M:, L:, K:) and notes"),
  description: z.string().describe("Brief plain-text explanation of the notation (max 100 chars)"),
  stepIndex: z.number().describe("The step index (0-based) this visual is for"),
});
