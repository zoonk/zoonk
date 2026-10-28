import { EPOCH_YEAR, FIRST_SUNDAY_OFFSET } from "@zoonk/utils/date";

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
