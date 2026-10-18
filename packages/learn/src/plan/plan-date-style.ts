import { daysBetween } from "../_utils/iso-date";

/** A date this close says its day and month alone: the next twelve months read without a year. */
const YEAR_AWAY_DAYS = 365;

export type PlanDateStyle = "day" | "dayYear" | "month" | "monthYear";

/**
 * How the Plan writes a date, one rule for every date on it (the path, the roadmap, its next
 * steps, its settings): "Jan 24" within twelve months of today and "Jan 24, 2028" beyond them; an
 * estimate the plan only knows to the month (`month`) as "Jan" or "Jan 2028" (the caller marks it
 * as an estimate).
 */
export function getPlanDateStyle({
  isoDate,
  month = false,
  today,
}: {
  isoDate: string;
  month?: boolean;
  today: string;
}): PlanDateStyle {
  const near = Math.abs(daysBetween(today, isoDate)) <= YEAR_AWAY_DAYS;

  if (month) {
    return near ? "month" : "monthYear";
  }

  return near ? "day" : "dayYear";
}
