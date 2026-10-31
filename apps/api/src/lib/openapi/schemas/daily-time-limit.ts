import { z } from "zod";

export const dailyTimeLimitResponseSchema = z
  .object({
    limitMinutes: z
      .int()
      .nullable()
      .meta({ description: "The learner's own daily limit in minutes, or null for none" }),
    reached: z.boolean(),
    remainingMinutes: z.int().nullable(),
    usedMinutes: z.int().meta({ description: "Minutes studied on the learner's local day" }),
  })
  .meta({ id: "DailyTimeLimitResponse" });
