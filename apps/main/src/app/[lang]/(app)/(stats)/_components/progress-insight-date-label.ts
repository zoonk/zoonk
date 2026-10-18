/**
 * Formats a calendar's days as the readout says them ("Oct 12"), keeping the persisted UTC
 * date-only value, with the year only for a day in an earlier year than the newest one: a year of
 * squares can hold two Oct 12s. Each form's formatter is built once and reused across the year.
 */
export function getProgressDayFormatter({
  locale,
  newest,
}: {
  locale: string;
  /** The calendar's newest day, whose year goes unsaid. */
  newest: Date | undefined;
}): (date: Date) => string {
  const sameYear = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  const otherYear = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });

  const year = newest?.getUTCFullYear();

  return (date: Date) => (date.getUTCFullYear() === year ? sameYear : otherYear).format(date);
}
