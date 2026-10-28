import { type WeeklyStudyTime } from "@zoonk/core/progress/weekly-study-time-contract";
import { z } from "zod";

const EXAMPLE_WEEKLY_MINUTES = 105;

/** This week's study time against the learner's budget, as Today's week and the Plan's pace show it. */
export const weeklyStudyTimeSchema = z.object({
  studiedMinutes: z
    .number()
    .int()
    .min(0)
    .meta({
      description:
        "Actual recorded study seconds this week, summed before rounding down to minutes",
    }),
  targetMinutes: z
    .number()
    .min(0)
    .meta({
      description:
        "The learner's shared weekly time budget across active goals, including past session targets. Exact minutes may be fractional; format them as a human duration for display.",
      examples: [EXAMPLE_WEEKLY_MINUTES],
    }),
}) satisfies z.ZodType<WeeklyStudyTime>;
