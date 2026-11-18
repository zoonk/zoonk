"use client";

import { Toggle } from "@zoonk/ui/components/toggle";
import { useFormatWeekday } from "../_utils/iso-date";

export const WEEKDAY_GRID_CLASS =
  "grid max-w-sm grid-cols-[repeat(auto-fit,minmax(min(100%,3.125rem),1fr))] gap-1";

export function WeekdayToggle({
  weekday,
  ...props
}: Omit<
  React.ComponentProps<typeof Toggle>,
  "aria-label" | "children" | "className" | "variant"
> & { weekday: number }) {
  const formatWeekday = useFormatWeekday();

  return (
    <Toggle
      className="h-11 min-w-0 px-1.5 wrap-anywhere whitespace-normal capitalize"
      variant="outline"
      {...props}
    >
      {formatWeekday(weekday, "short")}
    </Toggle>
  );
}
