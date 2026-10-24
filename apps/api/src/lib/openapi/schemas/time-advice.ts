import { dailyMinutesSchema } from "@zoonk/core/goals/contract";
import { z } from "zod";

/** Minutes as a query parameter: a whole number a goal's day can take. */
const minutesParamSchema = z.coerce.number().pipe(dailyMinutesSchema);

/**
 * The week a learner would study: its days, the weekend's own time when it has one, the time a day
 * they're looking at, whose share of the goal the answer says, and, for an exam, whether they'd
 * study everything.
 */
export const planTimeAdviceQuerySchema = z
  .object({
    dailyMinutes: minutesParamSchema
      .optional()
      .meta({
        description:
          "The weekdays' time a day the learner is looking at: the answer's coveredShare says what it covers by the goal's date. The goal's own time when absent",
      }),
    fullCourse: z
      .enum(["true", "false"])
      .optional()
      .meta({
        description:
          "Exams only: true plans the time asked about studying everything, going on after the exam for what doesn't fit before it (the plan change `setFullCourse`), and says when that ends (fullCourseEndDate). Other goals ignore it",
      }),
    studyDays: z
      .string()
      .regex(/^[0-6](?:,[0-6]){0,6}$/u)
      .optional()
      .meta({
        description:
          "The weekdays the learner would study, Sunday first, such as 1,2,3,4,5 for Monday to Friday; the plan's own days when absent",
      }),
    weekendMinutes: minutesParamSchema
      .optional()
      .meta({
        description:
          "The weekend's own time, when Saturday and Sunday get a time apart from the weekdays'. A new daily time leaves it as it is",
      }),
  })
  .meta({ id: "PlanTimeAdviceQuery" });

/**
 * The week a learner would study, for the daily time that covers their whole goal: its days and the
 * weekend's own time, which a new daily time leaves as it is. The plan's own week when absent.
 */
/** Weekdays as plans count them: Sunday is 0, Saturday 6. */
const LAST_WEEKDAY = 6;
const DAYS_PER_WEEK = 7;

export const planTimeToCoverInputSchema = z
  .object({
    studyDays: z
      .array(z.int().min(0).max(LAST_WEEKDAY))
      .min(1)
      .max(DAYS_PER_WEEK)
      .optional()
      .meta({
        description:
          "The weekdays the learner would study, Sunday first (0), such as [1, 2, 3, 4, 5] for Monday to Friday; the plan's own days when absent",
      }),
    weekendMinutes: dailyMinutesSchema
      .optional()
      .meta({
        description:
          "The weekend's own time, when Saturday and Sunday get a time apart from the weekdays'. The time found is the weekdays' time with it",
      }),
  })
  .meta({ id: "PlanTimeToCoverInput" });
