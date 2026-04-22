import { z } from "zod";

/**
 * Readable activity steps now carry their own illustration metadata instead of
 * relying on separate visual rows. Keeping the prompt and uploaded URL in one
 * shared schema lets generation, review, and the player all agree on the same
 * image shape.
 */
export const stepImageSchema = z
  .object({
    prompt: z.string(),
    url: z.string().optional(),
  })
  .strict();

export type StepImage = z.infer<typeof stepImageSchema>;
