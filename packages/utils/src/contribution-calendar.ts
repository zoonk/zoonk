import { MS_PER_DAY } from "./date";
import { getDateInTimeZone } from "./time-zone";

export const CONTRIBUTION_CALENDAR_DAYS_PER_WEEK = 7;

const FIRST_DAY_OF_MONTH = 1;
const PREVIOUS_CALENDAR_WEEKS = 52;

export type ContributionCalendarDateRange = { endDate: Date; startDate: Date };

export function getContributionCalendarDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getContributionCalendarDates({
  endDate,
  startDate,
}: {
  endDate: Date;
  startDate: Date;
}): Date[] {
  const dayCount = Math.max(
    0,
    Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1,
  );

  return Array.from(
    { length: dayCount },
    (_, dayIndex) => new Date(startDate.getTime() + dayIndex * MS_PER_DAY),
  );
}

export function groupContributionCalendarDaysByWeek<Day>(days: Day[]): Day[][] {
  return Array.from(
    { length: Math.ceil(days.length / CONTRIBUTION_CALENDAR_DAYS_PER_WEEK) },
    (_, weekIndex) =>
      days.slice(
        weekIndex * CONTRIBUTION_CALENDAR_DAYS_PER_WEEK,
        (weekIndex + 1) * CONTRIBUTION_CALENDAR_DAYS_PER_WEEK,
      ),
  );
}

export function getContributionCalendarMonthDate<Day extends { date: Date }>(
  week: Day[],
): Date | null {
  return week.find((day) => day.date.getUTCDate() === FIRST_DAY_OF_MONTH)?.date ?? null;
}

export function getContributionCalendarWeekKey<Day extends { date: Date }>(week: Day[]): string {
  return week.at(0)?.date.toISOString() ?? "empty-week";
}

export function getContributionCalendarKeyboardStartDate<Day extends { date: Date }>({
  days,
  hasActivity,
}: {
  days: Day[];
  hasActivity: (day: Day) => boolean;
}): Date | null {
  return days.findLast((day) => hasActivity(day))?.date ?? days.at(-1)?.date ?? null;
}

function getContributionCalendarStartDate(visibleEndDate: Date): Date {
  const daysBeforeCurrentWeek =
    visibleEndDate.getUTCDay() + PREVIOUS_CALENDAR_WEEKS * CONTRIBUTION_CALENDAR_DAYS_PER_WEEK;

  return new Date(visibleEndDate.getTime() - daysBeforeCurrentWeek * MS_PER_DAY);
}

export function getContributionCalendarDateRangeFromEndDate(
  endDate: Date,
): ContributionCalendarDateRange {
  return { endDate, startDate: getContributionCalendarStartDate(endDate) };
}

export function getContributionCalendarDateRange({
  now,
  timeZone = "UTC",
}: {
  now: Date;
  timeZone?: string;
}): ContributionCalendarDateRange {
  const terminalDate = getDateInTimeZone({ date: now, timeZone });

  return getContributionCalendarDateRangeFromEndDate(terminalDate);
}
