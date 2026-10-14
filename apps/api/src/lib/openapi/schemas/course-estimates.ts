import {
  coursePlanEstimateInputSchema,
  coursePlanEstimateSchema,
} from "@zoonk/core/catalog/course-estimate-contract";
import { z } from "zod";

/** The shared estimate's pace and date, represented as URL query values. */
export const courseEstimateQuerySchema = z
  .object({
    dailyMinutes: z.coerce.number().pipe(coursePlanEstimateInputSchema.shape.dailyMinutes),
    studyDays: z
      .string()
      .regex(/^[0-6](?:,[0-6])*$/u)
      .meta({
        description:
          "Unique study weekdays separated by commas, Sunday 0 to Saturday 6; for example 1,2,3,4,5",
      }),
    targetDate: coursePlanEstimateInputSchema.shape.targetDate,
  })
  .strict();

export const courseEstimateResponseSchema = coursePlanEstimateSchema.nullable();
