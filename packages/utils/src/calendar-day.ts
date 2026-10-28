import { MS_PER_DAY } from "./date";
import { getDateInTimeZone } from "./time-zone";

/** The calendar day an instant falls on in one time zone, as "YYYY-MM-DD". */
export function getIsoDay({ now, timeZone }: { now: Date; timeZone: string }): string {
  return getDateInTimeZone({ date: now, timeZone }).toISOString().slice(0, 10);
}

/** Whole days from one "YYYY-MM-DD" day to another. */
export function daysBetweenIsoDays({ from, to }: { from: string; to: string }): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

/** The "YYYY-MM-DD" day a number of days after another (before it, when negative). */
export function addIsoDays({ day, days }: { day: string; days: number }): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}
