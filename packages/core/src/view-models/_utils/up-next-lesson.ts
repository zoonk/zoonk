/**
 * The lesson a chapter's or a unit's page marks "Up next" and opens with Continue: the one today's
 * session opens next when it's on the page, as Today shows it; else the next one the plan teaches;
 * else the first not done in the page's order. Pages that took the first lesson not done in
 * teaching order sent Marcos to "Introducing yourself" while Today opened "Career summary".
 */
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
