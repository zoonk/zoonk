"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { daysBetween, useFormatGoalDate, useFormatIsoDate } from "../_utils/iso-date";
import { toLabelCase } from "../_utils/label-case";
import { usePlanScreen } from "../plan/plan-context";
import { useShortDays } from "../plan/use-short-plan";

/** An estimate this close says its day: "About October 2026" read oddly in October. */
const NEAR_ESTIMATE_DAYS = 42;

/**
 * An estimated date as the Plan says it: the month when it's far off, the day when it's within
 * a few weeks, so a plan ending this month never reads "October" in October.
 */
function useFormatEstimate() {
  const formatDate = useFormatIsoDate();
  const { plan } = usePlanScreen();

  return (isoDate: string): string =>
    formatDate(
      isoDate,
      daysBetween(plan.week.startDate, isoDate) <= NEAR_ESTIMATE_DAYS ? "day" : "month",
    );
}

/**
 * "Until about September 2027": when the plan ends at the learner's pace, said as the estimate it
 * is. One text for every place that says it (the plan's reveal, the Plan's path), so a goal
 * without a date never shows that end as its date. Null when the plan has no end yet.
 */
export function usePlanEndText(): string | null {
  const t = useExtracted();
  const formatEstimate = useFormatEstimate();
  const { plan } = usePlanScreen();
  const { endDate } = plan.estimate;

  return endDate ? t("Until about {date}", { date: formatEstimate(endDate) }) : null;
}

/**
 * Whether the finish of the path says when the goal is: its date, or, for a goal that isn't an
 * exam, when its plan ends. An exam without a date has a day nobody knows yet, so its last phase
 * says when the plan ends instead.
 */
function useFinishHasDate(): boolean {
  const { goal, plan } = usePlanScreen();
  return plan.schedule.targetDate !== null || goal.kind !== "exam";
}

/**
 * When a phase ends: its days in a plan for a test days away, otherwise its last day. Phases the
 * Library's graph sizes (learn plans) and studying after an exam are estimates, so the ones ahead
 * say the month, or the day when it's near. A done phase says nothing (its check says it), nor
 * does one the plan moved past with work set aside (its lessons done say it), and neither does
 * the last one, whose end the finish says, unless it comes after the exam's finish.
 */
export function usePhaseWhen() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatEstimate = useFormatEstimate();
  const shortDays = useShortDays();
  const planEnd = usePlanEndText();
  const finishHasDate = useFinishHasDate();
  const { plan } = usePlanScreen();
  const lastIndex = plan.phases.length - 1;

  return function phaseWhen(phase: PlanPhaseView): string | null {
    const days = shortDays(phase.short);

    if (days) {
      return days;
    }

    if (phase.state === "done" || phase.state === "unfinished" || phase.state === "leftOut") {
      return null;
    }

    // The last phase ends where the path does: the finish right after it says when, unless it's
    // an exam whose day isn't known. Studying after an exam comes after its finish, so it says
    // when it ends.
    if (phase.index === lastIndex && phase.kind !== "afterExam") {
      return finishHasDate ? null : planEnd;
    }

    if (!phase.endDate) {
      return null;
    }

    const isEstimate =
      (phase.kind === "learn" || phase.kind === "afterExam") && phase.state === "upcoming";

    return t("Until {date}", {
      date: isEstimate ? formatEstimate(phase.endDate) : formatDate(phase.endDate),
    });
  };
}

/**
 * When the goal is: its date ("About" an estimated day, the month the learner named as that
 * month), or when the plan ends at this pace. An exam without a date says it's to be confirmed:
 * the plan's end isn't the exam's day, and its last phase says that end (`usePhaseWhen`).
 */
export function useFinishDate(): string | null {
  const t = useExtracted();
  const formatEstimate = useFormatEstimate();
  const formatGoalDate = useFormatGoalDate();
  const finishHasDate = useFinishHasDate();
  const { plan } = usePlanScreen();
  const { targetDate, targetDateEstimated, targetDateNamedMonth } = plan.schedule;

  if (targetDate) {
    const date = formatGoalDate({ isoDate: targetDate, namedMonth: targetDateNamedMonth });

    if (targetDateNamedMonth) {
      return toLabelCase(date);
    }

    return targetDateEstimated ? t("About {date}", { date }) : date;
  }

  if (!finishHasDate) {
    return t("Date to be confirmed");
  }

  const { endDate } = plan.estimate;

  return endDate ? t("About {date}", { date: formatEstimate(endDate) }) : null;
}
