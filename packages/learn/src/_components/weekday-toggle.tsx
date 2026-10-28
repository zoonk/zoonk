"use client";

import { Toggle } from "@zoonk/ui/components/toggle";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { useFormatter } from "next-intl";

const REFERENCE_SUNDAY = Date.parse("2023-01-01T00:00:00Z");

export function WeekdayToggle({
  display,
  weekday,
  ...props
}: Omit<React.ComponentProps<typeof Toggle>, "aria-label" | "children"> & {
  display: "narrow" | "short";
  weekday: number;
}) {
  const format = useFormatter();
  const date = new Date(REFERENCE_SUNDAY + weekday * MS_PER_DAY);

  return (
    <Toggle aria-label={format.dateTime(date, { timeZone: "UTC", weekday: "long" })} {...props}>
      {format.dateTime(date, { timeZone: "UTC", weekday: display })}
    </Toggle>
  );
}
