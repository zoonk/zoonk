"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { daysBetween, useFormatIsoDate, useGoalDateValues } from "../_utils/iso-date";
import { toLabelCase } from "../_utils/label-case";
import { usePlanScreen } from "../plan/plan-context";
import { useShortDays } from "../plan/use-short-plan";

const NEAR_ESTIMATE_DAYS = 42;

function useFormatEstimate() {
  const formatDate = useFormatIsoDate();
  const { plan } = usePlanScreen();

  return (isoDate: string): { date: string; dateKind: "day" | "month" } => {
    const dateKind =
      daysBetween(plan.week.startDate, isoDate) <= NEAR_ESTIMATE_DAYS ? "day" : "month";

    return { date: formatDate(isoDate, dateKind), dateKind };
  };
}

export function usePlanEndText(): string | null {
  const t = useExtracted();
  const formatEstimate = useFormatEstimate();
  const { plan } = usePlanScreen();
  const { endDate } = plan.estimate;

  return endDate
    ? t({
        description:
          'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
        message: "{dateKind, select, month {Until about {date}} other {Until about {date}}}",
        values: formatEstimate(endDate),
      })
    : null;
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

    return t({
      description:
        'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
      message: "{dateKind, select, month {Until {date}} other {Until {date}}}",
      values: isEstimate
        ? formatEstimate(phase.endDate)
        : { date: formatDate(phase.endDate), dateKind: "day" },
    });
  };
}

export function useFinishDate(): string | null {
  const t = useExtracted();
  const formatEstimate = useFormatEstimate();
  const goalDate = useGoalDateValues();
  const finishHasDate = useFinishHasDate();
  const { plan } = usePlanScreen();
  const { targetDate, targetDateEstimated, targetDateNamedMonth } = plan.schedule;

  if (targetDate) {
    const shown = goalDate({ isoDate: targetDate, namedMonth: targetDateNamedMonth });

    if (targetDateNamedMonth) {
      return toLabelCase(shown.date);
    }

    return targetDateEstimated
      ? t({
          description:
            'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
          message: "{dateKind, select, month {About {date}} other {About {date}}}",
          values: shown,
        })
      : shown.date;
  }

  if (!finishHasDate) {
    return t("Date to be confirmed");
  }

  const { endDate } = plan.estimate;

  return endDate
    ? t({
        description:
          'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
        message: "{dateKind, select, month {About {date}} other {About {date}}}",
        values: formatEstimate(endDate),
      })
    : null;
}
