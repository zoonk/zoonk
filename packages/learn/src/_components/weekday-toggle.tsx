"use client";

import { Toggle } from "@zoonk/ui/components/toggle";
import { useLayoutEffect, useRef } from "react";
import { useFormatWeekday } from "../_utils/iso-date";

function pixels(value: string): number {
  return Number(value.replace(/px$/u, ""));
}

export function WeekdayGrid({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const grid = ref.current;
    const chip = grid?.firstElementChild;

    if (!grid || !chip) {
      return;
    }

    const labels = [...grid.querySelectorAll("[data-slot=weekday-label]")];

    const fit = () => {
      const { columnGap } = getComputedStyle(grid);
      const { borderLeftWidth, borderRightWidth } = getComputedStyle(chip);
      const gapWidth = (labels.length - 1) * pixels(columnGap);
      const track = (grid.getBoundingClientRect().width - gapWidth) / labels.length;
      const available = track - pixels(borderLeftWidth) - pixels(borderRightWidth);
      const wraps = labels.some((label) => label.getBoundingClientRect().width > available);
      grid.toggleAttribute("data-wrapped", wraps);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(grid);

    for (const label of labels) {
      observer.observe(label);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="grid max-w-sm grid-cols-7 gap-1 data-wrapped:grid-cols-4">
      {children}
    </div>
  );
}

export function WeekdayToggle({
  weekday,
  ...props
}: Omit<
  React.ComponentProps<typeof Toggle>,
  "aria-label" | "children" | "className" | "variant"
> & { weekday: number }) {
  const formatWeekday = useFormatWeekday();

  return (
    <Toggle className="h-control min-w-0 px-0 capitalize" variant="cell" {...props}>
      <span className="shrink-0 whitespace-nowrap" data-slot="weekday-label">
        {formatWeekday(weekday, "short")}
      </span>
    </Toggle>
  );
}
