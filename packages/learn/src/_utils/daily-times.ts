import { DAILY_TIME_CHOICES } from "@zoonk/core/plans/daily-minutes";

export function getDailyTimes(...shown: (number | null)[]): number[] {
  const own = shown.filter((time) => time !== null);
  return [...new Set([...DAILY_TIME_CHOICES, ...own])].toSorted((a, b) => a - b);
}
