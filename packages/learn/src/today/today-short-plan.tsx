"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CalendarDaysIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useShortDayRange, useShortFocusName } from "../plan/use-short-plan";
import { useTodayScreen } from "./today-context";

/** "Day 1 of 3 · Exam map and gaps": where today sits in a plan for a test days away. */
export function TodayShortPlan({ className }: { className?: string }) {
  const t = useExtracted();
  const dayRange = useShortDayRange();
  const focusName = useShortFocusName();
  const { today } = useTodayScreen();
  const short = today.shortPlan;

  if (!short) {
    return null;
  }

  return (
    <p
      className={cn(
        "flex w-fit items-start gap-2 text-sm font-medium",
        "in-data-[mode=fun]:fun-glass in-data-[mode=fun]:rounded-full in-data-[mode=fun]:px-3.5 in-data-[mode=fun]:py-2",
        className,
      )}
    >
      <LineMarker>
        <CalendarDaysIcon
          aria-hidden="true"
          className="text-muted-foreground in-data-[mode=fun]:text-fun-accent-cyan size-4"
        />
      </LineMarker>
      {t("{days} · {focus}", {
        days: dayRange({ days: short.days, first: short.day, last: short.day }),
        focus: focusName(short.focus),
      })}
    </p>
  );
}
