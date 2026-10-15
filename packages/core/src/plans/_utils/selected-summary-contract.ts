import { z } from "zod";

const minutesSchema = z.number().nonnegative();

const dailyNeedSchema = z.union([
  z.object({ basis: z.literal("estimated"), minutes: z.int().positive() }).strict(),
  z
    .object({
      basis: z.literal("estimated"),
      minutes: z.null(),
      reason: z.enum(["noDeadline", "nothingLeft", "noStudyDays", "exceedsDay"]),
    })
    .strict(),
]);

const baseSchema = z.object({
  choice: z.enum(["deep", "essential", "quick", "skip"]),
  known: z.boolean(),
  minutes: z.object({
    deep: minutesSchema,
    essential: minutesSchema,
    quick: minutesSchema.nullable(),
  }),
  skillId: z.string(),
});

/** Facts from the one selected build; no alternative plan or unselected fit claim is stored. */
export const selectedSummarySchema = z
  .object({
    bases: z
      .object({
        bases: z.array(baseSchema),
        daysLeft: z.int().nullable(),
        defaultChoice: z.enum(["essential", "quick"]),
      })
      .nullable(),
    coverage: z
      .object({
        basis: z.literal("selected"),
        coreFits: z.boolean(),
        coveredShare: z.number().min(0).max(1).nullable(),
        deadline: z.iso.date(),
        fits: z.boolean(),
        measure: z.enum(["exam", "goal"]),
        skills: z.array(
          z.object({
            coveredRaw: minutesSchema,
            requiredRaw: minutesSchema,
            skillId: z.string(),
            state: z.enum(["measured", "settled", "unknown"]),
            worth: minutesSchema,
          }),
        ),
      })
      .nullable(),
    dailyNeed: dailyNeedSchema,
    endDate: z.iso.date().nullable(),
    requirement: z.object({
      doneRaw: minutesSchema,
      remainingRaw: minutesSchema,
      totalRaw: minutesSchema,
    }),
    sourceSkillIds: z.array(z.string()),
    totalMinutes: minutesSchema,
  })
  .strict();

export type SelectedSummary = z.infer<typeof selectedSummarySchema>;
