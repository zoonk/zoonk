/** `busy`: another run, such as an explanation saving the lesson, holds its token or claim. */
export type LessonContentResult = {
  lessonId: string;
  status: "busy" | "heldBack" | "missing" | "ready";
};

/**
 * Starts a learner waits on carry it. A plan's starts don't: their run can fail admission and end
 * with no final event, which a learner handed its id would wait on forever.
 */
export function getLessonContentHookToken(lessonId: string): string {
  return `lesson-content:${lessonId}`;
}
