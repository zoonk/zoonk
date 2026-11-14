import { isInAnotherYear } from "@zoonk/utils/calendar-day";
import { getFormattingLocale } from "@zoonk/utils/locale";

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
  const sameYear = new Intl.DateTimeFormat(getFormattingLocale(locale), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  const otherYear = new Intl.DateTimeFormat(getFormattingLocale(locale), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });

  if (!newest) {
    return (date) => otherYear.format(date);
  }

  const latest = toIsoDay(newest);

  return (date: Date) =>
    (isInAnotherYear({ isoDate: toIsoDay(date), today: latest }) ? otherYear : sameYear).format(
      date,
    );
}
