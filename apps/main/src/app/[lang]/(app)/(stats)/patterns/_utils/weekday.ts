import { formatWeekdayName } from "@zoonk/utils/date-format";

type WeekdayInput = { dayOfWeek: number; locale: string };

export function getScoreWeekdayLabel({ dayOfWeek, locale }: WeekdayInput): string {
  return formatWeekdayName({ locale, weekday: dayOfWeek });
}

export function getScoreWeekdayShortLabel({ dayOfWeek, locale }: WeekdayInput): string {
  return formatWeekdayName({ locale, weekday: dayOfWeek, width: "short" });
}
