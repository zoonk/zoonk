"use client";

import { Toggle } from "@zoonk/ui/components/toggle";
import { useFormatWeekday } from "../_utils/iso-date";

export const WEEKDAY_GRID_CLASS = "flex max-w-sm flex-wrap gap-1";

export function WeekdayToggle({
  weekday,
  ...props
}: Omit<
  React.ComponentProps<typeof Toggle>,
  "aria-label" | "children" | "className" | "variant"
> & { weekday: number }) {
  const formatWeekday = useFormatWeekday();

  return (
    <Toggle className="h-11 min-w-max flex-1 px-1.5 capitalize" variant="outline" {...props}>
      {formatWeekday(weekday, "short")}
    </Toggle>
  );
}
