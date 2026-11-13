"use client";

import { Toggle } from "@zoonk/ui/components/toggle";
import { useFormatWeekday } from "../_utils/use-format-weekday";

export const WEEKDAY_GRID_CLASS = "grid max-w-sm grid-cols-7 gap-1";

export function WeekdayToggle({
  weekday,
  ...props
}: Omit<
  React.ComponentProps<typeof Toggle>,
  "aria-label" | "children" | "className" | "variant"
> & { weekday: number }) {
  const formatWeekday = useFormatWeekday();

  return (
    <Toggle className="h-11 min-w-0 px-0 capitalize" variant="outline" {...props}>
      {formatWeekday(weekday, "short")}
    </Toggle>
  );
}
