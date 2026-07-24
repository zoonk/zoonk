/**
 * Learning-day cards count calendar days with at least one completed lesson.
 * This total is intentionally all-time, so the shared completed-lesson
 * predicate does not apply a rolling or navigable period.
 */
export function getCompletedLessonDayWhere({ userId }: { userId: string }) {
  return { OR: [{ interactiveCompleted: { gt: 0 } }, { staticCompleted: { gt: 0 } }], userId };
}
