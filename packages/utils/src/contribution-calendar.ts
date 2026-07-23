import { MS_PER_DAY } from "./date";

export const CONTRIBUTION_CALENDAR_DAYS_PER_WEEK = 7;

const FIRST_DAY_OF_MONTH = 1;
const PREVIOUS_CALENDAR_WEEKS = 52;

export type ContributionCalendarDateRange = { endDate: Date; startDate: Date };

/**
 * Date-only keys preserve a contribution day's UTC identity when callers map
 * sparse stored values onto a complete calendar range.
 */
export function getContributionCalendarDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Produces every date in an inclusive UTC range so sparse metric rows can be
 * rendered alongside zero-value dates that have no stored record.
 */
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

/**
 * Contribution calendars read vertically within each week. Fixed seven-day
 * slices keep every consumer's visual columns aligned to calendar order.
 */
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

/**
 * Month labels belong to the week containing the month's first day. A partial
 * opening month remains unlabeled when its first day is outside the range.
 */
export function getContributionCalendarMonthDate<Day extends { date: Date }>(
  week: Day[],
): Date | null {
  return week.find((day) => day.date.getUTCDate() === FIRST_DAY_OF_MONTH)?.date ?? null;
}

/**
 * The first date provides a stable identity for a non-empty week without
 * coupling reusable calendar shaping to a particular rendering framework.
 */
export function getContributionCalendarWeekKey<Day extends { date: Date }>(week: Day[]): string {
  return week.at(0)?.date.toISOString() ?? "empty-week";
}

/**
 * Keyboard navigation starts on the newest meaningful date supplied by the
 * metric, or on the newest visible date when the calendar has no activity.
 */
export function getContributionCalendarKeyboardStartDate<Day extends { date: Date }>({
  days,
  hasActivity,
}: {
  days: Day[];
  hasActivity: (day: Day) => boolean;
}): Date | null {
  return days.findLast((day) => hasActivity(day))?.date ?? days.at(-1)?.date ?? null;
}

/**
 * Starts on Sunday so every seven-date slice becomes one complete contribution
 * calendar column, regardless of the weekday at the visible range's end.
 */
function getContributionCalendarStartDate(visibleEndDate: Date): Date {
  const daysBeforeCurrentWeek =
    visibleEndDate.getUTCDay() + PREVIOUS_CALENDAR_WEEKS * CONTRIBUTION_CALENDAR_DAYS_PER_WEEK;

  return new Date(visibleEndDate.getTime() - daysBeforeCurrentWeek * MS_PER_DAY);
}

/**
 * DateTimeFormat returns multiple part kinds, so this helper makes the required
 * calendar fields explicit before they become a UTC date-only value.
 */
function getNumericDatePart({
  dateParts,
  type,
}: {
  dateParts: Intl.DateTimeFormatPart[];
  type: "day" | "month" | "year";
}): number {
  return Number(dateParts.find((part) => part.type === type)?.value);
}

/**
 * Converts an instant into a date-only UTC value representing the calendar day
 * in the requested timezone. Keeping the result at UTC midnight lets database
 * date columns and calendar utilities compare the learner's local day safely.
 */
function getDateInTimeZone({ date, timeZone }: { date: Date; timeZone: string }): Date {
  const dateParts = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "numeric",
    timeZone,
    year: "numeric",
  }).formatToParts(date);

  return new Date(
    Date.UTC(
      getNumericDatePart({ dateParts, type: "year" }),
      getNumericDatePart({ dateParts, type: "month" }) - 1,
      getNumericDatePart({ dateParts, type: "day" }),
    ),
  );
}

/**
 * Builds the stable 53-week window used to query and render a contribution
 * calendar. The timezone makes the final square the learner's current calendar
 * day instead of whichever date happens to be current on the server.
 */
export function getContributionCalendarDateRange({
  now,
  timeZone = "UTC",
}: {
  now: Date;
  timeZone?: string;
}): ContributionCalendarDateRange {
  const terminalDate = getDateInTimeZone({ date: now, timeZone });

  return { endDate: terminalDate, startDate: getContributionCalendarStartDate(terminalDate) };
}
