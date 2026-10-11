/**
 * Mixed practice stays small while the basics are learned, then grows with the plan, and most of
 * all in the month and week before an exam, when practicing in the exam's format pays the most.
 */
const BASICS_SHARE_OF_PLAN = 0.15;
const EARLY_PRACTICE_SHARE = 0.1;
const BASE_PRACTICE_SHARE = 0.2;
const PRACTICE_GROWTH = 0.3;
const EXAM_MONTH_DAYS = 30;
const EXAM_MONTH_BOOST = 0.2;
const EXAM_WEEK_DAYS = 7;
const MAX_PRACTICE_SHARE = 0.6;

/** The share of a session's learning time that goes to mixed practice. */
export function getPracticeShare({
  daysToExam,
  planProgress,
}: {
  /** Days until the exam, or null for goals without one. */
  daysToExam: number | null;
  /** The share of plan items done, from 0 to 1. */
  planProgress: number;
}): number {
  if (daysToExam !== null && daysToExam <= EXAM_WEEK_DAYS) {
    return MAX_PRACTICE_SHARE;
  }

  const base =
    planProgress < BASICS_SHARE_OF_PLAN
      ? EARLY_PRACTICE_SHARE
      : BASE_PRACTICE_SHARE + PRACTICE_GROWTH * planProgress;

  const boost = daysToExam !== null && daysToExam <= EXAM_MONTH_DAYS ? EXAM_MONTH_BOOST : 0;

  return Math.min(MAX_PRACTICE_SHARE, base + boost);
}
