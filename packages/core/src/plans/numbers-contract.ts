import { z } from "zod";
import { ownLevelSchema } from "../learner/placement/placement-contract";

const minutesSchema = z.number().nonnegative();

export const planWorkloadSchema = z.object({
  checkpointMinutes: minutesSchema.describe(
    "Actual scheduled non-mock milestones and banked mock minutes, including milestone excess.",
  ),
  lessonMinutes: minutesSchema.describe(
    "Written lessons in the schedule at its sampled pace, including quick replacements.",
  ),
  practiceMinutes: minutesSchema.describe("Scheduled practice and review in addition to lessons."),
  unwrittenLessonMinutes: minutesSchema.describe(
    "Scheduled curriculum still to be written as the learner approaches it.",
  ),
});

export const planNumbersSchema = z
  .object({
    afterDeadlineMinutes: minutesSchema
      .nullable()
      .describe("Remaining scheduled work on or after targetDate; null without a date."),
    availableBeforeDeadlineMinutes: minutesSchema
      .nullable()
      .describe(
        "Actual allocated minutes from fromDate until targetDate, exclusive: weekday and light-week calendar, first-day rule, exam rest, mock funding and non-mock milestone excess. Null without a date.",
      ),
    beforeDeadlineMinutes: minutesSchema
      .nullable()
      .describe("Remaining scheduled work strictly before targetDate; null without a date."),
    context: z.object({
      dailyMinutes: z.int().nonnegative(),
      fromDate: z.iso.date(),
      fullCourse: z.boolean(),
      ownLevel: ownLevelSchema
        .nullable()
        .describe(
          "Public estimates start from none; actual plans retain the learner's stated level and progress.",
        ),
      paceFactor: z.number().positive(),
      targetDate: z.iso.date().nullable(),
      weekdayMinutes: z
        .array(z.int().nonnegative())
        .length(7)
        .describe(
          "Sunday first. Selected study days and distinct weekend time, before light weeks.",
        ),
    }),
    coverage: z
      .object({
        basis: z.literal("selected"),
        coveredShare: z.number().min(0).max(1),
        measure: z.enum(["exam", "goal"]),
        scope: z.literal("selectedCurriculum"),
      })
      .nullable()
      .describe(
        "What the plan covers by the date, the share it saves: each measured skill's lesson time the plan lays out before the deadline, over what its chosen requirement needs. Exam uses questions/points for notice subjects taught by selected graph skills; absent graph subjects and learner-excluded areas are not measured. Goal uses skill weights. Not a share of original published lesson IDs or a claim that every exam subject is represented.",
      ),
    milestoneExtraMinutesBeforeDeadline: minutesSchema
      .nullable()
      .describe(
        "The portion of availableBeforeDeadlineMinutes added by actual non-mock milestones exceeding their daily allocation; mocks stay banked.",
      ),
    scheduledMinutes: minutesSchema.describe(
      "Sum of the four rounded workload categories for remaining scheduled work from fromDate, including after-date work.",
    ),
    studyDaysBeforeDeadline: z
      .int()
      .nonnegative()
      .nullable()
      .describe(
        "Days with actual allocated study time before targetDate, including funded events and milestone excess; null without a date.",
      ),
    workload: planWorkloadSchema,
  })
  .meta({ id: "PlanNumbers" });

export type PlanWorkload = z.infer<typeof planWorkloadSchema>;
export type PlanNumbers = z.infer<typeof planNumbersSchema>;
