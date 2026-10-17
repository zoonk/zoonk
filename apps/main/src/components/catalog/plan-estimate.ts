import { type CoursePlanEstimate } from "@zoonk/core/catalog/course-estimate-contract";

/** A course's plan at one time a day, as core plans it from scratch. */
export type PaceEstimate = { estimate: CoursePlanEstimate; minutes: number };

/** An exam course's plan, read against the exam's date. */
export type DatedEstimate = Extract<CoursePlanEstimate, { fittingLessons: number }>;

/** A course's plan to its end. */
export type UndatedEstimate = Extract<CoursePlanEstimate, { weeks: number }>;

export function isDatedEstimate(estimate: CoursePlanEstimate): estimate is DatedEstimate {
  return "fittingLessons" in estimate;
}

/**
 * The plan's study time, from core's shared plan numbers (the ones the Plan and onboarding's time
 * question read too): what an exam plan studies before its date, a course's plan to its end. The
 * breakdown under it (`numbers.workload`) adds up to the same time.
 */
export function getStudyMinutes(estimate: CoursePlanEstimate): number {
  const { numbers } = estimate;
  return numbers.beforeDeadlineMinutes ?? numbers.scheduledMinutes;
}

/** The lesson time an exam plan studies by its date, quick and still-to-write lessons included. */
function getPlannedMinutes(estimate: DatedEstimate): number {
  return Math.round(estimate.areas.reduce((sum, area) => sum + area.plannedMinutes, 0));
}

/**
 * Whether a pace's plan has anything to show: a plan with no end ("~0 weeks") or one studying
 * nothing by the exam doesn't. One whose course lessons all wait for the exam's date still studies
 * through quick lessons and lessons still to be written, so its time counts, not its fitting count.
 */
export function hasStudyToShow(estimate: CoursePlanEstimate): boolean {
  return isDatedEstimate(estimate) ? getPlannedMinutes(estimate) > 0 : estimate.weeks > 0;
}
