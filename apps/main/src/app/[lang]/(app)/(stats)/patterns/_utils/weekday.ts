import { EPOCH_YEAR, FIRST_SUNDAY_OFFSET } from "@zoonk/utils/date";
import { getFormattingLocale } from "@zoonk/utils/locale";

type WeekdayInput = { dayOfWeek: number; locale: string };

function formatWeekday({
  dayOfWeek,
  locale,
  weekday,
}: WeekdayInput & { weekday: "long" | "short" }) {
  const referenceDate = new Date(EPOCH_YEAR, 0, FIRST_SUNDAY_OFFSET + dayOfWeek);

  return new Intl.DateTimeFormat(getFormattingLocale(locale), { weekday }).format(referenceDate);
}

export function getScoreWeekdayLabel(input: WeekdayInput): string {
  return formatWeekday({ ...input, weekday: "long" });
}

export function getScoreWeekdayShortLabel(input: WeekdayInput): string {
  return formatWeekday({ ...input, weekday: "short" });
}
