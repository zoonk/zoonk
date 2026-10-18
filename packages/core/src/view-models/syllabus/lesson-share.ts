/**
 * A goal measured in lessons (any goal but an exam): the share of its plan's lessons studied or
 * skipped as known (`SyllabusView.lessons`), 0 before it has any.
 */
export function getLessonShare({ done, total }: { done: number; total: number }): number {
  return total > 0 ? Math.min(1, done / total) : 0;
}
