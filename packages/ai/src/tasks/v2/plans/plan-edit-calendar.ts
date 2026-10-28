const MIN_DAILY_MINUTES = 5;
/** A whole day, as core's `MAX_DAILY_MINUTES` bounds it: core depends on this package. */
const MAX_DAILY_MINUTES = 1440;
const LAST_WEEKDAY = 6;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_DATE_LENGTH = 10;

type RawCalendarChange = {
  date: string | null;
  kind: string;
  minutes: number | null;
  weekdays: readonly number[] | null;
};

/** 0 minutes is a day off. */
export type TimeOperation =
  | { kind: "setDailyMinutes"; minutes: number }
  | { kind: "setWeekdayMinutes"; minutes: number; weekdays: number[] };

/** A goal date of none clears it. */
export type DateOperation =
  | { kind: "addLightWeek"; startDate: string }
  | { kind: "setTargetDate"; targetDate: string | null };

export function isValidDate(value: string | null): value is string {
  return (
    value !== null &&
    ISO_DATE.test(value) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, ISO_DATE_LENGTH) === value
  );
}

function toMinutes({ min, value }: { min: number; value: number | null }): number | null {
  return value === null || !Number.isFinite(value)
    ? null
    : Math.min(MAX_DAILY_MINUTES, Math.max(min, Math.round(value)));
}

function toWeekdays(values: readonly number[] | null): number[] {
  const valid = (values ?? []).filter(
    (value) => Number.isInteger(value) && value >= 0 && value <= LAST_WEEKDAY,
  );

  return [...new Set(valid)].toSorted((a, b) => a - b);
}

export function toTimeOperation(
  change: Pick<RawCalendarChange, "kind" | "minutes" | "weekdays">,
): TimeOperation | null {
  if (change.kind === "setDailyMinutes") {
    const minutes = toMinutes({ min: MIN_DAILY_MINUTES, value: change.minutes });
    return minutes === null ? null : { kind: "setDailyMinutes", minutes };
  }

  const minutes = toMinutes({ min: 0, value: change.minutes });
  const weekdays = toWeekdays(change.weekdays);

  return minutes === null || weekdays.length === 0
    ? null
    : { kind: "setWeekdayMinutes", minutes, weekdays };
}

export function toDateOperation({
  change,
  today,
}: {
  change: Pick<RawCalendarChange, "date" | "kind">;
  today: string;
}): DateOperation | null {
  if (change.kind === "clearTargetDate") {
    return { kind: "setTargetDate", targetDate: null };
  }

  if (!isValidDate(change.date)) {
    return null;
  }

  if (change.kind === "addLightWeek") {
    return change.date >= today ? { kind: "addLightWeek", startDate: change.date } : null;
  }

  return change.date > today ? { kind: "setTargetDate", targetDate: change.date } : null;
}
