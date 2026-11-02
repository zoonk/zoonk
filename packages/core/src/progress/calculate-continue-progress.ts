import { type GenerationStatus } from "@zoonk/db";

export type CourseContinueProgressChapter = {
  completedLessons: number;
  outlineStatus: GenerationStatus;
  totalLessons: number;
};

const MAX_INCOMPLETE_PERCENT = 99;

function normalizeCount(value: number): number {
  return Math.max(Math.round(value), 0);
}

/** Never reaches 100 until every item is complete. */
export function calculateProgressPercent({
  completedItems,
  totalItems,
}: {
  completedItems: number;
  totalItems: number;
}) {
  const total = normalizeCount(totalItems);

  if (total === 0) {
    return null;
  }

  const completed = Math.min(normalizeCount(completedItems), total);

  if (completed === 0 || completed === total) {
    return completed === 0 ? 0 : 100;
  }

  return Math.min(MAX_INCOMPLETE_PERCENT, Math.max(1, Math.round((completed / total) * 100)));
}

function countLessons(chapters: readonly CourseContinueProgressChapter[]): number {
  return chapters.reduce((total, chapter) => total + normalizeCount(chapter.totalLessons), 0);
}

/** Estimates unwritten outlines but never below the count of existing lessons. */
export function calculateCourseContinueProgressPercent({
  chapters,
}: {
  chapters: CourseContinueProgressChapter[];
}) {
  const generated = chapters.filter((chapter) => chapter.outlineStatus === "completed");
  const actualTotal = countLessons(chapters);
  const generatedTotal = countLessons(generated);

  const estimate =
    generated.length > 0 && generatedTotal > 0
      ? Math.round((generatedTotal / generated.length) * chapters.length)
      : 0;

  return calculateProgressPercent({
    completedItems: chapters.reduce(
      (total, chapter) => total + normalizeCount(chapter.completedLessons),
      0,
    ),
    totalItems: Math.max(actualTotal, estimate),
  });
}
