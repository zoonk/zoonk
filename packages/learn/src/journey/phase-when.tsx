"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { usePlanScreen } from "../plan/plan-context";
import { useFormatPlanDate } from "../plan/plan-date-text";
import { useShortDays } from "../plan/use-short-plan";
import { useIsFarEstimate } from "./use-roadmap";

type PhaseEnd = { days: string } | { estimate: boolean; isoDate: string; month: boolean };

/** A phase is behind the learner on its challenge's day, which can come after its last lesson. */
function getPhaseLastDay({ checkpoint, endDate }: PlanPhaseView): string | null {
  const challengeDay = checkpoint?.state === "upcoming" ? checkpoint.date : null;
  return challengeDay && endDate && challengeDay > endDate ? challengeDay : endDate;
}

/**
 * A learning phase ends when its lessons and challenge are done, so its end is an estimate while
 * it's ahead, and while it's current with its challenge (which has no booked day) still to come.
 */
function usePhaseEnd() {
  const shortDays = useShortDays();
  const isFar = useIsFarEstimate();
  const { goal, plan } = usePlanScreen();
  const lastIndex = plan.phases.findLast((phase) => phase.kind !== "afterExam")?.index;
  const finishShowsEnd = plan.schedule.targetDate !== null || goal.kind !== "exam";

  return function phaseEnd(phase: PlanPhaseView): PhaseEnd | null {
    const days = shortDays(phase.short);

    if (days) {
      return { days };
    }

    if (phase.state === "done" || phase.state === "unfinished" || phase.state === "leftOut") {
      return null;
    }

    if (phase.index === lastIndex) {
      const { endDate } = plan.estimate;

      return finishShowsEnd || !endDate
        ? null
        : { estimate: true, isoDate: endDate, month: isFar(endDate) };
    }

    const lastDay = getPhaseLastDay(phase);

    if (!lastDay) {
      return null;
    }

    const learns = phase.kind === "learn" || phase.kind === "afterExam";
    const ahead = phase.state === "upcoming";
    const estimate = learns && (ahead || phase.checkpoint?.state === "upcoming");

    return { estimate, isoDate: lastDay, month: estimate && ahead && isFar(lastDay) };
  };
}

/**
 * When a phase ends, at the end of its row or under the roadmap's bar: "Dec 12", "~Dec 12" or
 * "~Jan", read aloud as "Ends about Dec 12". The place says it's the end, so it has no "until".
 */
export function PhaseWhen({ className, phase }: { className?: string; phase: PlanPhaseView }) {
  const t = useExtracted();
  const phaseEnd = usePhaseEnd();
  const formatPlanDate = useFormatPlanDate();
  const end = phaseEnd(phase);

  if (!end) {
    return null;
  }

  if ("days" in end) {
    return <span className={cn(className, "font-sans")}>{end.days}</span>;
  }

  const date = formatPlanDate(end.isoDate, { month: end.month });

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      <span aria-hidden="true">{end.estimate ? t("~{date}", { date }) : date}</span>
      <span className="sr-only">
        {end.estimate
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
            })}
      </span>
    </span>
  );
}
