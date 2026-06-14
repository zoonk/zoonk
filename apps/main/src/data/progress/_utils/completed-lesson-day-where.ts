import { type ProgressDateFilter } from "./progress-date-filter";

/**
 * Learning-day cards count calendar days with at least one completed lesson.
 * The Level page passes a period window, while the homepage intentionally omits
 * one because its card is the all-time total for the signed-in user.
 */
export function getCompletedLessonDayWhere({
  dateFilter,
  userId,
}: {
  dateFilter?: ProgressDateFilter;
  userId: string;
}) {
  return {
    OR: [{ interactiveCompleted: { gt: 0 } }, { staticCompleted: { gt: 0 } }],
    ...(dateFilter ? { date: dateFilter } : {}),
    userId,
  };
}
