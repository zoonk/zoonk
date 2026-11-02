import { addDays, daysBetween, getStartOfWeek } from "./plan-calendar";
import { getExamWindows } from "./plan-phases";
import { DAYS_PER_WEEK, type WrittenCadence } from "./plan-state";

const FINAL_WEEKS_MIN_DAYS = 21;
const FINAL_WEEKS_MAX_DAYS = 56;
const FINAL_WEEKS_SHARE = 1 / 3;

const DAYS_BETWEEN_SPREAD_ESSAYS = 3;
const DAYS_BETWEEN_CONCENTRATED_ESSAYS = 2;

export type WrittenSchedule = { cadence: WrittenCadence; planStart: Date; targetDate: Date | null };

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

function isFinalStretch({ date, planStart, targetDate }: { date: Date } & WrittenSchedule) {
  const stretch = targetDate
    ? getExamWindows({ planStart, targetDate }).find((window) => window.kind === "finalStretch")
    : undefined;

  return stretch !== undefined && date >= stretch.startDate;
}

/** The planner and sessions both read written days from here. */
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

export function getDaysBetweenEssays(schedule: WrittenSchedule): number {
  return getEffectiveCadence(schedule) === "weekly"
    ? DAYS_BETWEEN_SPREAD_ESSAYS
    : DAYS_BETWEEN_CONCENTRATED_ESSAYS;
}
