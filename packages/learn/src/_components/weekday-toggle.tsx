"use client";

import { Toggle } from "@zoonk/ui/components/toggle";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { useFormatter } from "next-intl";

/** A Sunday, so weekday `n` (0 for Sunday, as plans count weekdays) is `n` days after it. */
const FIRST_SUNDAY = Date.parse("2023-01-01T00:00:00Z");

/**
 * A day of the week to study or not, pressed while it's a study day. It shows the day short ("M"
 * with `narrow`, "Mon" with `short`) and is named by the whole day ("Monday"), its only name, so a
 * screen reader says the day once with its state.
 */
export function WeekdayToggle({
  display,
  weekday,
  ...props
}: Omit<React.ComponentProps<typeof Toggle>, "aria-label" | "children"> & {
  display: "narrow" | "short";
  weekday: number;
}) {
  const format = useFormatter();
  const date = new Date(FIRST_SUNDAY + weekday * MS_PER_DAY);

  return (
    <Toggle aria-label={format.dateTime(date, { timeZone: "UTC", weekday: "long" })} {...props}>
      {format.dateTime(date, { timeZone: "UTC", weekday: display })}
    </Toggle>
  );
}
