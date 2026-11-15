"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { usePlanScreen } from "../plan/plan-context";
import { useFormatPlanDate } from "../plan/plan-date-text";
import { useShortDays } from "../plan/use-short-plan";
import { getPhaseEnd } from "./phase-dates";

/** A phase's end from the shared rule (`getPhaseEnd`), a short plan's days already said. */
export function usePhaseEnd() {
  const shortDays = useShortDays();
  const { plan } = usePlanScreen();

  return function phaseEnd(phase: PlanPhaseView) {
    const end = getPhaseEnd({ phase, plan });

    if (end && "short" in end) {
      const days = shortDays(end.short);
      return days ? { days } : null;
    }

    return end;
  };
}

/** How a phase's end is read aloud: "Ends Dec 12", "Ends about Dec 12", or a short plan's days. */
export function usePhaseEndSpoken() {
  const t = useExtracted();
  const phaseEnd = usePhaseEnd();
  const formatPlanDate = useFormatPlanDate();

  return function phaseEndSpoken(phase: PlanPhaseView): string | null {
    const end = phaseEnd(phase);

    if (!end) {
      return null;
    }

    if ("days" in end) {
      return end.days;
    }

    const date = formatPlanDate(end.isoDate, { month: end.month });

    return end.estimate
      ? t({
          description:
            'In the month form, {date} is a month, like "Jan"; otherwise a day, like "Dec 12".',
          message: "{dateKind, select, month {Ends about {date}} other {Ends about {date}}}",
          values: { date, dateKind: end.month ? "month" : "day" },
        })
      : t({
          description: 'When a phase of the plan ends. {date} is a day, like "Dec 12".',
          message: "Ends {date}",
          values: { date },
        });
  };
}

/**
 * When a phase ends, at the end of its row or under the roadmap's bar: "Dec 12", "~Dec 12" or
 * "~Jan", read aloud as "Ends about Dec 12". The place says it's the end, so it has no "until".
 */
export function PhaseWhen({ className, phase }: { className?: string; phase: PlanPhaseView }) {
  const t = useExtracted();
  const phaseEnd = usePhaseEnd();
  const phaseEndSpoken = usePhaseEndSpoken();
  const formatPlanDate = useFormatPlanDate();
  const end = phaseEnd(phase);

  if (!end) {
    return null;
  }

  if ("days" in end) {
    return (
      <span className={cn(className, "font-sans")} data-slot="phase-when">
        {end.days}
      </span>
    );
  }

  const date = formatPlanDate(end.isoDate, { month: end.month });

  return (
    <span className={cn("font-mono tabular-nums", className)} data-slot="phase-when">
      <span aria-hidden="true">{end.estimate ? t("~{date}", { date }) : date}</span>
      <span className="sr-only">{phaseEndSpoken(phase)}</span>
    </span>
  );
}
