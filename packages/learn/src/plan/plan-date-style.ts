import { isInAnotherYear } from "@zoonk/utils/calendar-day";

export type PlanDateStyle = "day" | "dayYear" | "month" | "monthYear";

export function getPlanDateStyle({
  isoDate,
  month = false,
  today,
}: {
  isoDate: string;
  month?: boolean;
  today: string;
}): PlanDateStyle {
  const anotherYear = isInAnotherYear({ isoDate, today });

  if (month) {
    return anotherYear ? "monthYear" : "month";
  }

  return anotherYear ? "dayYear" : "day";
}
