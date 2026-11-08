import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "../../plans/daily-minutes";
import { DAYS_PER_WEEK } from "../../plans/planner/plan-state";

export const timeZoneSchema = z
  .string()
  .refine(isValidTimeZone, { message: "Invalid timezone" })
  .optional()
  .meta({ description: "The learner's IANA timezone, for relative dates; UTC when left out" });

export const scheduleAnswerSchema = z
  .object({
    dailyMinutes: z.int().min(MIN_DAILY_MINUTES).max(MAX_DAILY_MINUTES),
    fullCourse: z
      .boolean()
      .optional()
      .meta({
        description:
          "Exams only: study everything, even after the exam (see the plan change `setFullCourse`). Until the exam the plan stays the one its date shapes; what doesn't fit goes on after it",
      }),
    question: z.literal("schedule"),
    studyDays: z
      .array(
        z
          .int()
          .min(0)
          .max(DAYS_PER_WEEK - 1),
      )
      .min(1)
      .max(DAYS_PER_WEEK)
      .optional(),
    timeZone: timeZoneSchema,
    weekendMinutes: z
      .int()
      .min(MIN_DAILY_MINUTES)
      .max(MAX_DAILY_MINUTES)
      .optional()
      .meta({
        description:
          "Minutes on Saturday and Sunday when they differ from the other days; only study days take them",
      }),
  })
  .strict();
