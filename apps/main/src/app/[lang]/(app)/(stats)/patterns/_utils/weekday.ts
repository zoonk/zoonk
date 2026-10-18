import { EPOCH_YEAR, FIRST_SUNDAY_OFFSET } from "@zoonk/utils/date";

/**
 * Formats a stored weekday index with one stable reference calendar so the
 * overview and the full pattern breakdown always use the same localized name.
 */
export function getScoreWeekdayLabel({
  dayOfWeek,
  locale,
}: {
  dayOfWeek: number;
  locale: string;
}): string {
  const referenceDate = new Date(EPOCH_YEAR, 0, FIRST_SUNDAY_OFFSET + dayOfWeek);

  return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(referenceDate);
}
