import { z } from "zod";

const MAX_INTEREST_LENGTH = 120;
const MAX_INTERESTS = 50;

export const learningProfileInputSchema = z
  .object({
    interests: z.array(z.string().trim().min(1).max(MAX_INTEREST_LENGTH)).max(MAX_INTERESTS),
  })
  .strict();

export type LearningProfileInput = z.infer<typeof learningProfileInputSchema>;
