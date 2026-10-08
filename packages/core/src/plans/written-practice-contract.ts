import { z } from "zod";
import { WRITTEN_CADENCES } from "./planner/plan-state";

/**
 * When an exam's written tests (a redação, a discursive test) are practiced, which the learner
 * chooses (see `WRITTEN_CADENCES`); the total practice stays the same.
 */
export const writtenPracticeSchema = z
  .object({
    cadence: z
      .enum(WRITTEN_CADENCES)
      .meta({
        description:
          "weekly (the default: spaced practice), biweekly (every other calendar week from the plan's first, and the final stretch) or finalWeeks (only the final weeks before the exam). Change it with a setWrittenCadence plan operation",
      }),
    finalWeeksFrom: z.iso
      .date()
      .nullable()
      .meta({
        description:
          "The first day of the final weeks, when that choice applies; null when the plan has no date or is all final weeks, so finalWeeks isn't offered",
      }),
    parts: z
      .array(z.string())
      .meta({ description: "The written tests, as the plan's areas name them" }),
  })
  .meta({ id: "WrittenPractice" });

export type WrittenPractice = z.infer<typeof writtenPracticeSchema>;
