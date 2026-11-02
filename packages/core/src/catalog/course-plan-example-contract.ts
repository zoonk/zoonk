import { z } from "zod";
import { type CoursePlanEstimate, coursePlanEstimateSchema } from "./course-estimate-contract";

export type PaceEstimate = { estimate: CoursePlanEstimate; minutes: number };

export type DatedEstimate = Extract<CoursePlanEstimate, { fittingLessons: number }>;

export type UndatedEstimate = Extract<CoursePlanEstimate, { weeks: number }>;

export function isDatedEstimate(estimate: CoursePlanEstimate): estimate is DatedEstimate {
  return "fittingLessons" in estimate;
}

export function getStudyMinutes(estimate: CoursePlanEstimate): number {
  const { numbers } = estimate;
  return numbers.beforeDeadlineMinutes ?? numbers.scheduledMinutes;
}

function getPlannedMinutes(estimate: DatedEstimate): number {
  return Math.round(estimate.areas.reduce((sum, area) => sum + area.plannedMinutes, 0));
}

export function hasStudyToShow(estimate: CoursePlanEstimate): boolean {
  return isDatedEstimate(estimate) ? getPlannedMinutes(estimate) > 0 : estimate.weeks > 0;
}

export const coursePlanExampleSchema = z
  .object({
    exam: z
      .object({
        days: z.array(z.iso.date()).min(1),
        daysLeft: z.int().nonnegative(),
        estimated: z.boolean(),
        timeZone: z.string(),
      })
      .nullable(),
    pace: z.object({ estimate: coursePlanEstimateSchema, minutes: z.int().positive() }).nullable(),
  })
  .meta({ id: "CoursePlanExample" });

export type CoursePlanExample = z.infer<typeof coursePlanExampleSchema>;
