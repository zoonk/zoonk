import { formatIsoDate } from "@zoonk/utils/date-format";

const ISO_DAY_LENGTH = "YYYY-MM-DD".length;

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, ISO_DAY_LENGTH);
}

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
  const latest = newest ? toIsoDay(newest) : null;

  return (date: Date) =>
    formatIsoDate({
      isoDate: toIsoDay(date),
      locale,
      today: latest ?? toIsoDay(date),
      ...(!latest && { year: "always" as const }),
    });
}
