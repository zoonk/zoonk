/**
 * Keeps the persisted UTC date-only value. The year shows only for an earlier year than the newest
 * day's: a year of squares can hold two Oct 12s.
 */
export function getProgressDayFormatter({
  locale,
  newest,
}: {
  locale: string;
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
