/** Prioritizes Today's next lesson, then plan order, then page order; each must still be unfinished on this page. */
export function findUpNextLessonId({
  lessons,
  planLessonIds,
  sessionLessonIds,
}: {
  /** The page's lessons, in its order. */
  lessons: readonly { done: boolean; lessonId: string }[];
  /** The plan's lessons not done, in its order. */
  planLessonIds: readonly string[];
  /** Today's session's lessons, the one open first, then those not started, in its order. */
  sessionLessonIds: readonly string[];
}): string | null {
  const open = new Set(lessons.flatMap((lesson) => (lesson.done ? [] : [lesson.lessonId])));

  return (
    sessionLessonIds.find((lessonId) => open.has(lessonId)) ??
    planLessonIds.find((lessonId) => open.has(lessonId)) ??
    lessons.find((lesson) => !lesson.done)?.lessonId ??
    null
  );
}
