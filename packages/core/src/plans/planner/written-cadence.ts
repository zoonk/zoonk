import { addDays, daysBetween, getStartOfWeek } from "./plan-calendar";
import { getExamWindows } from "./plan-phases";
import { DAYS_PER_WEEK, type WrittenCadence } from "./plan-state";

/**
 * "Only the final weeks" is about a third of the plan before the exam: never less than three
 * weeks, enough for an essay every other day to make a difference, and never more than eight,
 * which wouldn't be the final weeks anymore.
 */
const FINAL_WEEKS_MIN_DAYS = 21;
const FINAL_WEEKS_MAX_DAYS = 56;
const FINAL_WEEKS_SHARE = 1 / 3;

/** Graded essays spread over the plan come every few days; concentrated, every other day. */
const DAYS_BETWEEN_SPREAD_ESSAYS = 3;
const DAYS_BETWEEN_CONCENTRATED_ESSAYS = 2;

/** What decides when the written tests are practiced: the learner's cadence and the plan's dates. */
export type WrittenSchedule = {
  cadence: WrittenCadence;
  /** The plan's first day: every other week counts from its week (Monday to Sunday). */
  planStart: Date;
  targetDate: Date | null;
};

/**
 * The cadence that applies: anything but every week needs the exam's date to count back from,
 * and a plan that's all final weeks (an exam three weeks away) is practiced every week anyway.
 */
export function getEffectiveCadence({
  cadence,
  planStart,
  targetDate,
}: WrittenSchedule): WrittenCadence {
  if (!targetDate) {
    return "weekly";
  }

  return cadence === "finalWeeks" && daysBetween(planStart, targetDate) <= FINAL_WEEKS_MIN_DAYS
    ? "weekly"
    : cadence;
}

/** The first day of the final weeks before the exam (see `FINAL_WEEKS_SHARE`). */
export function getFinalWeeksStart({
  planStart,
  targetDate,
}: {
  planStart: Date;
  targetDate: Date;
}): Date {
  const planDays = daysBetween(planStart, targetDate);

  const length = Math.min(
    FINAL_WEEKS_MAX_DAYS,
    Math.max(FINAL_WEEKS_MIN_DAYS, Math.round(planDays * FINAL_WEEKS_SHARE)),
  );

  return planDays <= length ? planStart : addDays(targetDate, -length);
}

/** The exam's final stretch, where every cadence practices writing before the exam. */
function isFinalStretch({ date, planStart, targetDate }: { date: Date } & WrittenSchedule) {
  const stretch = targetDate
    ? getExamWindows({ planStart, targetDate }).find((window) => window.kind === "finalStretch")
    : undefined;

  return stretch !== undefined && date >= stretch.startDate;
}

/**
 * Whether the written tests are practiced on a day: every day for every week; the plan's first,
 * third… week (Monday to Sunday, as the week view shows them) and the final stretch for every
 * other week; and the final weeks for only the final weeks. The planner puts the written tests' lessons only on these days, and
 * sessions their graded essays.
 */
export function isWrittenDay(input: WrittenSchedule & { date: Date }): boolean {
  const { date, planStart, targetDate } = input;
  const cadence = getEffectiveCadence(input);

  switch (cadence) {
    case "weekly":
      return true;
    case "biweekly":
      return (
        Math.floor(daysBetween(getStartOfWeek(planStart), date) / DAYS_PER_WEEK) % 2 === 0 ||
        isFinalStretch(input)
      );
    case "finalWeeks":
      return targetDate !== null && date >= getFinalWeeksStart({ planStart, targetDate });
    default:
      return cadence satisfies never;
  }
}

/** Days from one graded essay to the next: closer together when practice is concentrated. */
export function getDaysBetweenEssays(schedule: WrittenSchedule): number {
  return getEffectiveCadence(schedule) === "weekly"
    ? DAYS_BETWEEN_SPREAD_ESSAYS
    : DAYS_BETWEEN_CONCENTRATED_ESSAYS;
}
