"use client";

import { MS_PER_DAY } from "@zoonk/utils/date";
import { useFormatter } from "next-intl";

const REFERENCE_SUNDAY = Date.parse("2023-01-01T00:00:00Z");

export function useFormatWeekday() {
  const format = useFormatter();

  return (weekday: number, width: "long" | "short" | "narrow" = "long") =>
    format.dateTime(new Date(REFERENCE_SUNDAY + weekday * MS_PER_DAY), {
      timeZone: "UTC",
      weekday: width,
    });
}
