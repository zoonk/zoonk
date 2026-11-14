import { readQueryParam } from "@/lib/query-param";
import { type Route } from "next";

export const DEFAULT_COMPLETED_LESSONS_THRESHOLD = 10;
export const DEFAULT_LEARNING_DAYS_THRESHOLD = 3;

const MAX_THRESHOLD = 1000;
const MIN_THRESHOLD = 1;

type SearchParamValue = string | string[] | undefined;

export type LearnerMilestoneKind = "completedLessons" | "learningDays";

export function parseLearnerMilestoneKind(value: SearchParamValue): LearnerMilestoneKind {
  const firstValue = readQueryParam(value);

  return isLearnerMilestoneKind(firstValue) ? firstValue : "completedLessons";
}

/** Clamped, so a hand-edited query string never asks for an unbounded grouping. */
export function parseLearnerMilestoneThreshold({
  defaultValue,
  value,
}: {
  defaultValue: number;
  value: SearchParamValue;
}) {
  const firstValue = readQueryParam(value);
  const trimmedValue = firstValue?.trim();

  if (!trimmedValue) {
    return defaultValue;
  }

  const parsedValue = Number(trimmedValue);

  if (!Number.isFinite(parsedValue)) {
    return defaultValue;
  }

  return Math.min(Math.max(Math.trunc(parsedValue), MIN_THRESHOLD), MAX_THRESHOLD);
}

export function getDefaultLearnerMilestoneThreshold({ kind }: { kind: LearnerMilestoneKind }) {
  if (kind === "learningDays") {
    return DEFAULT_LEARNING_DAYS_THRESHOLD;
  }

  return DEFAULT_COMPLETED_LESSONS_THRESHOLD;
}

export function getLearnerMilestoneCopy({
  kind,
  threshold,
}: {
  kind: LearnerMilestoneKind;
  threshold: number;
}) {
  if (kind === "learningDays") {
    return {
      emptyMessage: `No learner has studied on ${threshold} or more days yet.`,
      help: `Learners who completed lessons on at least ${threshold} different days, all time`,
      listTitle: "Learners by days studied",
      pageTitle: `${threshold}+ days studied`,
      unit: "days",
    };
  }

  return {
    emptyMessage: `No learner has completed ${threshold} or more lessons yet.`,
    help: `Learners who completed at least ${threshold} lessons, all time`,
    listTitle: "Learners by lessons completed",
    pageTitle: `${threshold}+ lessons completed`,
    unit: "lessons",
  };
}

export function buildLearnerMilestoneUsersHref({
  kind,
  threshold,
}: {
  kind: LearnerMilestoneKind;
  threshold: number;
}): Route {
  const params = new URLSearchParams({ kind, threshold: threshold.toString() });

  return `/stats/engagement/learners?${params.toString()}`;
}

function isLearnerMilestoneKind(value: string | undefined): value is LearnerMilestoneKind {
  return value === "completedLessons" || value === "learningDays";
}
