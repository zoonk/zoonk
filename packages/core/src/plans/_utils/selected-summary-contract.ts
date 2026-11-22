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

const shortLessonSchema = z
  .object({
    countedRaw: minutesSchema,
    lessonId: z.string(),
    requiredRaw: minutesSchema,
    skillIds: z.array(z.string()),
  })
  .strict();

const baseChoiceSchema = z.enum(["deep", "essential", "quick", "skip"]);

const baseSchema = z.object({
  area: z.string(),
  choice: baseChoiceSchema,
  choices: z.array(baseChoiceSchema),
  known: z.boolean(),
  minutes: z.object({
    deep: minutesSchema,
    essential: minutesSchema,
    quick: minutesSchema.nullable(),
  }),
  name: z.string(),
  neededFor: z.array(z.string()),
  skillId: z.string(),
  studied: z.boolean(),
});

const coverageSchema = z.object({
  basis: z.literal("selected"),
  coreFits: z.boolean(),
  coveredShare: z.number().min(0).max(1).nullable(),
  deadline: z.iso.date(),
  fits: z.boolean(),
  measure: z.enum(["exam", "goal"]),
  shortLessons: z.array(shortLessonSchema),
  skills: z.array(
    z.object({
      coveredRaw: minutesSchema,
      requiredRaw: minutesSchema,
      skillId: z.string(),
      state: z.enum(["measured", "settled", "unknown"]),
      worth: minutesSchema,
    }),
  ),
  targetDate: z.iso.date(),
});

export const selectedSummarySchema = z
  .object({
    bases: z
      .object({
        bases: z.array(baseSchema),
        daysLeft: z.int().nullable(),
        defaultChoice: z.enum(["essential", "quick"]),
      })
      .nullable(),
    coverage: coverageSchema.nullable(),
    endDate: z.iso.date().nullable(),
    forecast: z
      .object({
        basis: z.literal("estimated"),
        dailyNeed: dailyNeedSchema,
        finish: z.union([
          z.object({ date: z.iso.date() }).strict(),
          z
            .object({
              date: z.null(),
              reason: z.enum(["nothingLeft", "noStudyDays", "beyondHorizon"]),
            })
            .strict(),
        ]),
      })
      .strict(),
    phaseDates: z.object({ structureKey: z.string().nullable(), trigger: z.boolean() }).strict(),
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
export type SelectedCoverage = NonNullable<SelectedSummary["coverage"]>;
export type DailyNeed = z.infer<typeof dailyNeedSchema>;
