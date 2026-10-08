import { EPOCH_YEAR, FIRST_SUNDAY_OFFSET } from "@zoonk/utils/date";

const SCORE_WEEKDAY_MESSAGE_VALUES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/**
 * Maps a stored weekday index to the enum value used by ICU select messages so
 * each locale can choose the complete grammar for recurring weekday patterns.
 */
export function getScoreWeekdayMessageValue(dayOfWeek: number) {
  return SCORE_WEEKDAY_MESSAGE_VALUES[dayOfWeek] ?? "other";
}

/**
 * Formats a stored weekday index with one stable reference calendar so the
 * summary cards and full pattern breakdown always use the same localized name.
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

/**
 * Keeps the compact chart readable on a phone while using the learner's own
 * locale instead of storing English abbreviations in the visualization.
 */
export function getScoreWeekdayShortLabel({
  dayOfWeek,
  locale,
}: {
  dayOfWeek: number;
  locale: string;
}): string {
  const referenceDate = new Date(EPOCH_YEAR, 0, FIRST_SUNDAY_OFFSET + dayOfWeek);

  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(referenceDate);
}
