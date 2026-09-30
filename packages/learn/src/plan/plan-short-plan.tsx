"use client";

import { CalendarClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { usePlanScreen } from "./plan-context";

/**
 * The plan's shape in one line: its days and when the short mock rehearses the test, that its last
 * day is a light review, or with the test tomorrow, that its one day goes to the topics that come
 * up most.
 */
function useShortPlanText(): string | null {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { plan } = usePlanScreen();
  const short = plan.shortPlan;

  if (!short) {
    return null;
  }

  if (short.mockDate) {
    return t(
      "{days, plural, one {A one-day plan} other {A #-day plan}} with a short mock on {day}",
      { day: formatDate(short.mockDate, "weekday"), days: short.days },
    );
  }

  return short.days === 1
    ? t("A one-day plan for the topics that come up most")
    : t("A {days, number}-day plan, with a light review the day before your exam", {
        days: short.days,
      });
}

/** A plan for a test days away says its shape up front, above its days. */
export function PlanShortPlan() {
  const text = useShortPlanText();

  if (!text) {
    return null;
  }

  return (
    <p className="bg-muted/60 in-data-[mode=fun]:fun-glass flex items-start gap-2 rounded-2xl px-4 py-3 text-sm">
      <CalendarClockIcon
        aria-hidden="true"
        className="text-muted-foreground in-data-[mode=fun]:text-fun-accent-cyan mt-0.5 size-4 shrink-0"
      />
      {text}
    </p>
  );
}
