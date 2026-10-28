"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { daysBetween, useFormatGoalDate, useFormatIsoDate } from "../_utils/iso-date";
import { toLabelCase } from "../_utils/label-case";
import { usePlanScreen } from "../plan/plan-context";
import { useShortDays } from "../plan/use-short-plan";

const NEAR_ESTIMATE_DAYS = 42;

function useFormatEstimate() {
  const formatDate = useFormatIsoDate();
  const { plan } = usePlanScreen();

  return (isoDate: string): string =>
    formatDate(
      isoDate,
      daysBetween(plan.week.startDate, isoDate) <= NEAR_ESTIMATE_DAYS ? "day" : "month",
    );
}

export function usePlanEndText(): string | null {
  const t = useExtracted();
  const formatEstimate = useFormatEstimate();
  const { plan } = usePlanScreen();
  const { endDate } = plan.estimate;

  return endDate ? t("Until about {date}", { date: formatEstimate(endDate) }) : null;
}

function useFinishHasDate(): boolean {
  const { goal, plan } = usePlanScreen();
  return plan.schedule.targetDate !== null || goal.kind !== "exam";
}

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
