export type PublishedLessonProgressScope =
  | { chapterId: number }
  | { courseId: number }
  | { lessonId: number };

export type PublishedLessonProgressRow = {
  brandSlug: string | null;
  chapterId: number;
  chapterPosition: number;
  chapterSlug: string;
  completedActivities: number;
  courseId: number;
  courseSlug: string;
  lessonDescription: string;
  lessonGenerationStatus: "completed" | "failed" | "pending" | "running";
  lessonId: number;
  lessonPosition: number;
  lessonSlug: string;
  lessonTitle: string;
  pendingActivities: number;
  totalActivities: number;
};

export type EffectiveLessonProgressRow = PublishedLessonProgressRow & {
  isDurablyCompleted: boolean;
  isEffectivelyCompleted: boolean;
};

/**
 * Direct activity counts still matter for incomplete lessons, while durable
 * lesson completion takes over once the learner has already earned that lesson.
 * This helper merges both signals into one per-lesson state.
 */
export function toEffectiveLessonProgressRows({
  durablyCompletedLessonIds,
  rows,
}: {
  durablyCompletedLessonIds: Set<number>;
  rows: PublishedLessonProgressRow[];
}): EffectiveLessonProgressRow[] {
  return rows.map((row) => {
    const isDurablyCompleted = durablyCompletedLessonIds.has(row.lessonId);

    const isEffectivelyCompleted =
      isDurablyCompleted ||
      (row.totalActivities > 0 && row.completedActivities >= row.totalActivities);

    return {
      ...row,
      isDurablyCompleted,
      isEffectivelyCompleted,
    };
  });
}
