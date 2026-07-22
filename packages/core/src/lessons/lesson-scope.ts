/**
 * Curriculum progress can be resolved for a whole course, one chapter, or one
 * lesson. Keeping the scope union independent from any query lets async leaves
 * and pure selectors share the same canonical boundary.
 */
export type LessonScope = { courseId: string } | { chapterId: string } | { lessonId: string };
