import { dailyMinutesSchema } from "@zoonk/core/goals/contract";
import { z } from "zod";

/** Minutes as a query parameter: a whole number a goal's day can take. */
const minutesParamSchema = z.coerce.number().pipe(dailyMinutesSchema);

/**
 * The week a learner would study: its days, the weekend's own time when it has one, and the time a
 * day they're looking at, whose share of the goal the answer says.
 */
export const planTimeAdviceQuerySchema = z
  .object({
    dailyMinutes: minutesParamSchema
      .optional()
      .meta({
        description:
          "The weekdays' time a day the learner is looking at: the answer's coveredShare says what it covers by the goal's date. The goal's own time when absent. It never changes the time recommended",
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
          "The weekend's own time, when Saturday and Sunday get a time apart from the weekdays'. A new daily time leaves it as it is, so the time recommended is the weekdays' time with it",
      }),
  })
  .meta({ id: "PlanTimeAdviceQuery" });
