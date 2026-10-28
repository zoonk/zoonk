import { daysBetween } from "../_utils/iso-date";

const YEAR_AWAY_DAYS = 365;

export type PlanDateStyle = "day" | "dayYear" | "month" | "monthYear";

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
