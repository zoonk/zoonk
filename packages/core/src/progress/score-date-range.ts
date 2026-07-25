import { getContributionCalendarDateRange } from "@zoonk/utils/contribution-calendar";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { DEFAULT_PROGRESS_LOOKBACK_DAYS } from "@zoonk/utils/date-ranges";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";

const SCORE_LOOKBACK_DAY_OFFSET = DEFAULT_PROGRESS_LOOKBACK_DAYS - 1;
const TIME_ZONE_SEARCH_BUFFER = 2 * MS_PER_DAY;

type DateRange = { endDate: Date; startDate: Date };

/**
 * The DailyProgress table stores learner-local dates as UTC-midnight values,
 * while StepAttempt stores real instants. Keeping both ranges together prevents
 * Score surfaces backed by those different tables from drifting apart.
 */
export type ScoreDateRange = { dailyProgress: DateRange; stepAttempts: DateRange };

export type ScoreRangeParams = { endDate?: Date; now?: Date; startDate?: Date; timeZone?: string };

/**
 * Converts an instant to a comparable UTC-midnight value for its local
 * calendar date. Comparing date-only values avoids assumptions about whether
 * a timezone's day begins at 00:00 during offset transitions.
 */
function getLocalDateTimestamp({ date, timeZone }: { date: Date; timeZone: string }): number {
  return getDateInTimeZone({ date, timeZone }).getTime();
}

/**
 * Finds the first instant whose local calendar date reaches the requested
 * date. A recursive binary search keeps the boundary exact to the millisecond
 * without assuming that every local date starts at midnight.
 */
function findFirstInstantOnOrAfterLocalDate({
  lowerBound,
  targetDate,
  timeZone,
  upperBound,
}: {
  lowerBound: number;
  targetDate: number;
  timeZone: string;
  upperBound: number;
}): Date {
  if (lowerBound >= upperBound) {
    return new Date(lowerBound);
  }

  const candidate = Math.floor((lowerBound + upperBound) / 2);
  const candidateDate = getLocalDateTimestamp({ date: new Date(candidate), timeZone });

  if (candidateDate < targetDate) {
    return findFirstInstantOnOrAfterLocalDate({
      lowerBound: candidate + 1,
      targetDate,
      timeZone,
      upperBound,
    });
  }

  return findFirstInstantOnOrAfterLocalDate({
    lowerBound,
    targetDate,
    timeZone,
    upperBound: candidate,
  });
}

/**
 * Converts a UTC-midnight date-only value into the real instant when that date
 * begins in the learner's timezone. Searching for the first instant whose
 * local date matches also handles timezones that skip midnight during an
 * offset transition, such as America/Santiago.
 */
function getStartOfDateInTimeZone({ date, timeZone }: { date: Date; timeZone: string }): Date {
  const targetDate = date.getTime();
  const searchStart = targetDate - TIME_ZONE_SEARCH_BUFFER;
  const searchEnd = targetDate + TIME_ZONE_SEARCH_BUFFER;

  const candidate = findFirstInstantOnOrAfterLocalDate({
    lowerBound: searchStart,
    targetDate,
    timeZone,
    upperBound: searchEnd,
  });

  if (getLocalDateTimestamp({ date: candidate, timeZone }) !== targetDate) {
    throw new RangeError(`The local date ${date.toISOString()} does not exist in ${timeZone}`);
  }

  return candidate;
}

/**
 * Preserves explicit historical query compatibility. Callers that provide a
 * start date already pass concrete database boundaries, so both persistence
 * models continue to use those exact instants.
 */
function getExplicitScoreDateRange({
  endDate,
  now,
  startDate,
}: {
  endDate?: Date;
  now: Date;
  startDate: Date;
}): ScoreDateRange {
  const resolvedEndDate = endDate ?? now;
  const range = { endDate: resolvedEndDate, startDate };

  return { dailyProgress: range, stepAttempts: range };
}

/**
 * Keeps every Score surface on exactly 90 learner-local calendar dates,
 * including today. DailyProgress uses date-only boundaries, while StepAttempt
 * starts at the first local midnight and stops at the actual request instant.
 */
export function getScoreDateRange({
  endDate,
  now = new Date(),
  startDate,
  timeZone = "UTC",
}: ScoreRangeParams = {}): ScoreDateRange {
  if (startDate) {
    return getExplicitScoreDateRange({ endDate, now, startDate });
  }

  const currentInstant = endDate ?? now;

  const { endDate: dailyProgressEndDate } = getContributionCalendarDateRange({
    now: currentInstant,
    timeZone,
  });

  const dailyProgressStartDate = new Date(
    dailyProgressEndDate.getTime() - SCORE_LOOKBACK_DAY_OFFSET * MS_PER_DAY,
  );

  return {
    dailyProgress: { endDate: dailyProgressEndDate, startDate: dailyProgressStartDate },
    stepAttempts: {
      endDate: currentInstant,
      startDate: getStartOfDateInTimeZone({ date: dailyProgressStartDate, timeZone }),
    },
  };
}
