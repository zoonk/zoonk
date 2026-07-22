import { toEffectiveLessonProgressRows } from "./_utils/published-lesson-progress";
import { type PublishedLessonProgressRow } from "./progress-queries";

export type LessonProgress = { isCompleted: boolean; lessonId: string };

export type LessonProgressInput = { rows: PublishedLessonProgressRow[] };

/**
 * Chapter pages need one progress row per listed lesson so the catalog can
 * show completion without loading every lesson separately.
 */
export function getLessonProgress({ rows }: LessonProgressInput): LessonProgress[] {
  return toEffectiveLessonProgressRows({ rows }).map((row) => ({
    isCompleted: row.isEffectivelyCompleted,
    lessonId: row.lessonId,
  }));
}
