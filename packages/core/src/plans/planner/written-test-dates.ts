import { MS_PER_DAY } from "@zoonk/utils/date";

const FINAL_WEEK_DAYS = 7;

export function pickWrittenTestDays({
  sectionMinutes,
  studyDays,
  targetDate,
}: {
  sectionMinutes: number | null;
  studyDays: readonly { date: string; minutes: number }[];
  targetDate: Date | string;
}): string[] {
  if (!sectionMinutes) {
    return [];
  }

  const end = new Date(targetDate).getTime();

  const days = studyDays
    .map((day) => ({ ...day, instant: Date.parse(day.date) }))
    .filter((day) => day.instant < end)
    .toSorted((a, b) => a.instant - b.instant);

  const first = days[0];

  if (!first) {
    return [];
  }

  const midpoint = (first.instant + end) / 2;
  const finalWeek = end - FINAL_WEEK_DAYS * MS_PER_DAY;
  const feasible = days.filter((day) => day.minutes >= sectionMinutes);
  const last = feasible.findLast((day) => day.instant >= finalWeek);

  const middle = feasible
    .filter((day) => day.instant < finalWeek)
    .toSorted((a, b) => Math.abs(a.instant - midpoint) - Math.abs(b.instant - midpoint))[0];

  return [middle?.date, last?.date].filter((date) => date !== undefined);
}
