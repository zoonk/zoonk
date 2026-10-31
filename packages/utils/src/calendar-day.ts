import { MS_PER_DAY } from "./date";
import { getDateInTimeZone } from "./time-zone";

export function getIsoDay({ now, timeZone }: { now: Date; timeZone: string }): string {
  return getDateInTimeZone({ date: now, timeZone }).toISOString().slice(0, 10);
}

export function daysBetweenIsoDays({ from, to }: { from: string; to: string }): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

export function addIsoDays({ day, days }: { day: string; days: number }): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}
