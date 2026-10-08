import { z } from "zod";

/** The weekdays a learner would study, as a comma-separated list of 0 (Sunday) to 6. */
export const planTimeAdviceQuerySchema = z
  .object({
    studyDays: z
      .string()
      .regex(/^[0-6](?:,[0-6]){0,6}$/u)
      .optional()
      .meta({
        description:
          "The weekdays the learner would study, Sunday first, such as 1,2,3,4,5 for Monday to Friday; the plan's own days when absent",
      }),
  })
  .meta({ id: "PlanTimeAdviceQuery" });
