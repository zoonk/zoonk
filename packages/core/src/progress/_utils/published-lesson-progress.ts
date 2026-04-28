export type PublishedLessonProgressScope =
  | { chapterId: string }
  | { courseId: string }
  | { lessonId: string };

export type PublishedLessonProgressRow = {
  brandSlug: string | null;
  chapterId: string;
  chapterPosition: number;
  chapterSlug: string;
  completedLessons: number;
  courseId: string;
  courseSlug: string;
  lessonDescription: string;
  lessonGenerationStatus: "completed" | "failed" | "pending" | "running";
  lessonId: string;
  lessonKind:
    | "alphabet"
    | "custom"
    | "explanation"
    | "grammar"
    | "listening"
    | "practice"
    | "quiz"
    | "reading"
    | "review"
    | "translation"
    | "tutorial"
    | "vocabulary";
  lessonPosition: number;
  lessonSlug: string;
  lessonTitle: string;
  pendingLessons: number;
  totalLessons: number;
};

export type EffectiveLessonProgressRow = PublishedLessonProgressRow & {
  isDurablyCompleted: boolean;
  isEffectivelyCompleted: boolean;
};

/**
 * Direct lesson counts still matter for incomplete lessons, while durable
 * lesson completion takes over once the learner has already earned that lesson.
 * This helper merges both signals into one per-lesson state.
 */
export function toEffectiveLessonProgressRows({
  durablyCompletedLessonIds,
  rows,
}: {
  durablyCompletedLessonIds: Set<string>;
  rows: PublishedLessonProgressRow[];
}): EffectiveLessonProgressRow[] {
  return rows.map((row) => {
    const isDurablyCompleted = durablyCompletedLessonIds.has(row.lessonId);

    const isEffectivelyCompleted =
      isDurablyCompleted || (row.totalLessons > 0 && row.completedLessons >= row.totalLessons);

    return {
      ...row,
      isDurablyCompleted,
      isEffectivelyCompleted,
    };
  });
}
