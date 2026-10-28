import { dailyMinutesSchema } from "@zoonk/core/goals/contract";
import { z } from "zod";

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

export const planTimeAdviceInputSchema = planTimeToCoverInputSchema
  .extend({ dailyMinutes: dailyMinutesSchema.optional(), fullCourse: z.boolean().optional() })
  .meta({ id: "PlanTimeAdviceInput" });
