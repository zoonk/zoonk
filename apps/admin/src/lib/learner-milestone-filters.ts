export const DEFAULT_COMPLETED_LESSONS_THRESHOLD = 10;
export const DEFAULT_LEARNING_DAYS_THRESHOLD = 3;

const MAX_THRESHOLD = 1000;
const MIN_THRESHOLD = 1;

type SearchParamValue = string | string[] | undefined;

export type LearnerMilestoneKind = "completedLessons" | "learningDays";

/**
 * Milestone drill-down links need stable query values instead of page copy.
 * Keeping the URL vocabulary here prevents the summary cards and user list
 * page from drifting when labels change.
 */
export function parseLearnerMilestoneKind(value: SearchParamValue): LearnerMilestoneKind {
  const firstValue = getFirstSearchParam(value);

  return isLearnerMilestoneKind(firstValue) ? firstValue : "completedLessons";
}

/**
 * Admin thresholds are typed into URL-backed number inputs. Clamping here keeps
 * every milestone query finite and avoids accidental unbounded grouping from a
 * hand-edited query string.
 */
export function parseLearnerMilestoneThreshold({
  defaultValue,
  value,
}: {
  defaultValue: number;
  value: SearchParamValue;
}) {
  const firstValue = getFirstSearchParam(value);
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

/**
 * Direct visits to the learner list only provide the milestone kind. The
 * default threshold needs to match the summary card that links to that list.
 */
export function getDefaultLearnerMilestoneThreshold({ kind }: { kind: LearnerMilestoneKind }) {
  if (kind === "learningDays") {
    return DEFAULT_LEARNING_DAYS_THRESHOLD;
  }

  return DEFAULT_COMPLETED_LESSONS_THRESHOLD;
}

/**
 * Summary cards and drill-down pages describe the same milestone. Centralizing
 * the copy keeps the count, page title, and empty state aligned.
 */
export function getLearnerMilestoneCopy({
  kind,
  threshold,
}: {
  kind: LearnerMilestoneKind;
  threshold: number;
}) {
  if (kind === "learningDays") {
    return {
      emptyMessage: `No users have completed lessons on ${threshold} or more days yet.`,
      help: `Users who completed lessons on at least ${threshold} different days, all time`,
      inputLabel: "Learning days",
      pageTitle: `${threshold}+ Learning Days`,
      tableCaption: `Users who completed lessons on at least ${threshold} different days.`,
    };
  }

  return {
    emptyMessage: `No users have completed ${threshold} or more lessons yet.`,
    help: `Users who completed at least ${threshold} lessons, all time`,
    inputLabel: "Completed lessons",
    pageTitle: `${threshold}+ Completed Lessons`,
    tableCaption: `Users who completed at least ${threshold} lessons.`,
  };
}

/**
 * The milestone cards link to the same list route with different query values.
 * URLSearchParams handles encoding while this helper keeps the route shape in
 * one place.
 */
export function buildLearnerMilestoneUsersHref({
  kind,
  threshold,
}: {
  kind: LearnerMilestoneKind;
  threshold: number;
}) {
  const params = new URLSearchParams({ kind, threshold: threshold.toString() });

  return `/stats/engagement/learners?${params.toString()}`;
}

/**
 * Runtime URL values are plain strings. This guard narrows them to the finite
 * milestone modes that the SQL loaders know how to query.
 */
function isLearnerMilestoneKind(value: string | undefined): value is LearnerMilestoneKind {
  return value === "completedLessons" || value === "learningDays";
}

/**
 * Next.js returns repeated query params as arrays. Milestone filters only use
 * one value per key, so the first entry is the canonical value.
 */
function getFirstSearchParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
