"use client";

import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { usePlanScreen } from "./plan-context";

/** Where the estimate comes from, so the learner knows how much to trust it. */
export function usePaceNote(): string {
  const t = useExtracted();
  const { plan } = usePlanScreen();

  const source = plan.estimate.pace?.source ?? "typical";

  switch (source) {
    case "own":
      return t("Based on your own pace. It gets more precise as you study.");
    case "course":
      return t("Based on how long other learners take. It gets more precise as you study.");
    case "typical":
      return t("A first estimate. It gets more precise as you study.");
    default:
      return t("A first estimate. It gets more precise as you study.");
  }
}

const MINUTES_PER_HOUR = 60;

/**
 * An amount of study: hours, minutes under an hour, and nothing while it's unknown, so a plan or
 * a phase never reads "0 h".
 */
export function useStudySize() {
  const t = useExtracted();

  return function studySize(hours: number): string | null {
    const minutes = Math.round(hours * MINUTES_PER_HOUR);

    if (minutes <= 0) {
      return null;
    }

    return minutes < MINUTES_PER_HOUR
      ? t("~{minutes, number} min", { minutes })
      : t("~{hours, number} h", { hours: Math.round(hours) });
  };
}

/** The plan's size in the learner's words: hours of study and when it ends at this pace. */
export function usePlanEstimate() {
  const formatDate = useFormatIsoDate();
  const studySize = useStudySize();
  const { plan } = usePlanScreen();
  const { endDate, remainingHours, totalHours } = plan.estimate;

  // A plan for a test days away ends within the week: the month alone would say nothing.
  return {
    endDate: endDate ? formatDate(endDate, plan.shortPlan ? "weekday" : "month") : null,
    remaining: studySize(remainingHours),
    total: studySize(totalHours),
  };
}

/** "45 min a day · 6 days a week": the schedule in one line. */
export function useScheduleLine(): string {
  const t = useExtracted();
  const { plan } = usePlanScreen();

  return t(
    "{minutes, number} min a day · {days, plural, one {# day a week} other {# days a week}}",
    { days: plan.schedule.studyDays, minutes: plan.schedule.dailyMinutes },
  );
}
