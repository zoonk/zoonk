import "server-only";
import { type CourseChapter, listCourseChapters } from "@/data/chapters/list-course-chapters";
import { listChapterLessons } from "@/data/lessons/list-chapter-lessons";
import { type Lesson, type LessonKind } from "@zoonk/db";
import {
  type CourseContinueProgressChapter,
  calculateCourseContinueProgressPercent,
  calculateProgressPercent,
} from "./_utils/continue-progress-percent";
import { getCatalogChapterProgress, getCatalogLessonProgress } from "./catalog-progress";

export type ContinueLessonProgress = { percentComplete: number };

/**
 * A chapter counts as complete on the course CTA when every visible lesson is
 * complete. Reusing the same filtered chapter rows as the cards prevents a
 * hidden lesson type from keeping the course progress suffix stuck behind the
 * lesson set the learner chose not to see.
 */
export async function getCourseContinueProgress({
  courseId,
  excludedLessonKinds = [],
}: {
  courseId: string;
  excludedLessonKinds?: LessonKind[];
}): Promise<ContinueLessonProgress | null> {
  const [chapterProgressRows, chapters] = await Promise.all([
    getCatalogChapterProgress({ courseId, excludedLessonKinds }),
    listCourseChapters({ courseId }),
  ]);

  const progressRowsByChapterId = new Map(chapterProgressRows.map((row) => [row.chapterId, row]));

  const progressChapters = chapters.map((chapter) =>
    getCourseContinueProgressChapter({ chapter, progressRowsByChapterId }),
  );

  return toContinueLessonProgress(
    calculateCourseContinueProgressPercent({ chapters: progressChapters }),
  );
}

/**
 * Chapter-level progress still counts lessons because chapter pages list the
 * concrete lesson rows. Reusing cached lesson progress keeps this aligned with
 * the status badges rendered by the lesson grid.
 */
export async function getChapterContinueProgress({
  chapterId,
  excludedLessonKinds = [],
}: {
  chapterId: string;
  excludedLessonKinds?: LessonKind[];
}): Promise<ContinueLessonProgress | null> {
  const [progressRows, lessons] = await Promise.all([
    getCatalogLessonProgress({ chapterId, excludedLessonKinds }),
    listChapterLessons({ chapterId }),
  ]);

  return toContinueLessonProgress(
    calculateProgressPercent({
      completedItems: progressRows.filter((row) => row.isCompleted).length,
      totalItems: countVisibleLessons({ excludedLessonKinds, lessons }),
    }),
  );
}

/**
 * The UI only needs a visible percentage. Returning null lets callers keep the
 * existing no-progress fallback when there is no useful denominator.
 */
function toContinueLessonProgress(percentComplete: number | null): ContinueLessonProgress | null {
  if (percentComplete === null) {
    return null;
  }

  return { percentComplete };
}

/**
 * The course estimate consumes one row per published chapter, so chapters with
 * no visible lessons still contribute their generation status and zero counts.
 */
function getCourseContinueProgressChapter({
  chapter,
  progressRowsByChapterId,
}: {
  chapter: CourseChapter;
  progressRowsByChapterId: Map<string, { completedLessons: number; totalLessons: number }>;
}): CourseContinueProgressChapter {
  const progress = progressRowsByChapterId.get(chapter.id);

  return {
    completedLessons: progress?.completedLessons ?? 0,
    generationStatus: chapter.generationStatus,
    totalLessons: progress?.totalLessons ?? 0,
  };
}

/**
 * Chapter progress counts the same visible lesson kinds as the progress query,
 * while reusing the public lesson outline already needed by catalog routes.
 */
function countVisibleLessons({
  excludedLessonKinds,
  lessons,
}: {
  excludedLessonKinds: LessonKind[];
  lessons: Lesson[];
}) {
  return lessons.filter((lesson) => !excludedLessonKinds.includes(lesson.kind)).length;
}
