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

/** A lesson the plan holds and counts less than whole by the deadline (see `shortLessons`). */
const shortLessonSchema = z
  .object({
    countedRaw: minutesSchema,
    lessonId: z.string(),
    requiredRaw: minutesSchema,
    skillIds: z.array(z.string()),
  })
  .strict();

/**
 * One of the plan's bases as the layout studied it: what it is (its area, name and the skills it's
 * needed for, see `PlanBase`), whether the learner knows it, each way's minutes and the choice.
 */
const baseSchema = z.object({
  area: z.string(),
  choice: z.enum(["deep", "essential", "quick", "skip"]),
  known: z.boolean(),
  minutes: z.object({
    deep: minutesSchema,
    essential: minutesSchema,
    quick: minutesSchema.nullable(),
  }),
  name: z.string(),
  neededFor: z.array(z.string()),
  skillId: z.string(),
});

/** What the selected plan covers of the chosen requirement by the deadline (see `getCoverage`). */
const coverageSchema = z.object({
  basis: z.literal("selected"),
  coreFits: z.boolean(),
  coveredShare: z.number().min(0).max(1).nullable(),
  deadline: z.iso.date(),
  fits: z.boolean(),
  measure: z.enum(["exam", "goal"]),
  /**
   * The requirement's lessons the plan holds and counts less than whole by the deadline (one
   * running past it, or after it), each once with the skills it counts for: finishing one of
   * them is the only completion that changes what the plan covers.
   */
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
  /** The goal's date the plan was measured against: another date makes these numbers past. */
  targetDate: z.iso.date(),
});

/**
 * Facts from the one selected build; no alternative plan or unselected fit claim is stored. They
 * describe the stored plan as its layout posted them: coverage reductions follow completions that
 * change it (see `reduceCompletedSummary`), the rest stays as of that layout.
 */
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
    /**
     * About what the work left asks, as this layout's own days read it: the daily time it needs by
     * the deadline and when it would all be done. Estimates, never an exact plan.
     */
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
    /**
     * Whether keeping the phase dates the learner saw may cost them something (see
     * `mayCostToKeepPhaseDates`), and what of the layout says so (`structureKey`): a card the
     * learner resolved stays resolved until that changes.
     */
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
