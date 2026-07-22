import { type PublishedLessonProgressRow } from "../progress-queries";

export type EffectiveLessonProgressRow = PublishedLessonProgressRow & {
  isDurablyCompleted: boolean;
  isEffectivelyCompleted: boolean;
};

/**
 * A completed lesson-progress row is the durable lesson signal. Naming the
 * derived flags once keeps every progress selector aligned without issuing a
 * second query against the same lesson-progress table.
 */
export function toEffectiveLessonProgressRows({
  rows,
}: {
  rows: PublishedLessonProgressRow[];
}): EffectiveLessonProgressRow[] {
  return rows.map((row) => {
    const isDurablyCompleted = row.completedLessons > 0;
    const isEffectivelyCompleted = row.totalLessons > 0 && row.completedLessons >= row.totalLessons;

    return { ...row, isDurablyCompleted, isEffectivelyCompleted };
  });
}
