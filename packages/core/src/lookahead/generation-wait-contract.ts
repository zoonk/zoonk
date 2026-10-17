import { z } from "zod";

/** A wait longer than this is a page left open, not a wait anyone sat through. */
const MAX_WAIT_MS = 600_000;

export const generationWaitInputSchema = z
  .object({
    contentKind: z
      .enum(["lesson", "explanation", "curriculum"])
      .meta({ description: "What the learner waited for" }),
    locale: z.string().min(2).max(10).optional(),
    milliseconds: z
      .int()
      .min(0)
      .max(MAX_WAIT_MS)
      .meta({ description: "From the first waiting screen to ready content, in milliseconds" }),
    platform: z.enum(["android", "ios", "web"]).optional(),
  })
  .strict()
  .meta({ id: "GenerationWaitInput" });

export type GenerationWaitInput = z.infer<typeof generationWaitInputSchema>;
