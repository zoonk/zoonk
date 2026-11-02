"use client";

import { Toggle } from "@zoonk/ui/components/toggle";
import { useFormatWeekday } from "../_utils/use-format-weekday";

export function WeekdayToggle({
  display,
  weekday,
  ...props
}: Omit<React.ComponentProps<typeof Toggle>, "aria-label" | "children"> & {
  display: "narrow" | "short";
  weekday: number;
}) {
  const formatWeekday = useFormatWeekday();

  return (
    <Toggle aria-label={formatWeekday(weekday)} {...props}>
      {formatWeekday(weekday, display)}
    </Toggle>
  );
}
