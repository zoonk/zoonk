export type CourseContinueProgressChapter = {
  completedLessons: number;
  generationStatus: string;
  totalLessons: number;
};

const GENERATED_CHAPTER_STATUS = "completed";
const MAX_PERCENT = 100;
const MIN_VISIBLE_STARTED_PERCENT = 1;
const MAX_INCOMPLETE_PERCENT = 99;

/**
 * Converts completed and total item counts into the integer percentage shown in
 * catalog CTAs.
 */
export function calculateProgressPercent({
  completedItems,
  totalItems,
}: {
  completedItems: number;
  totalItems: number;
}) {
  const normalizedTotalItems = normalizeCount({ value: totalItems });

  if (normalizedTotalItems === 0) {
    return null;
  }

  const normalizedCompletedItems = clampCompletedItems({
    completedItems,
    totalItems: normalizedTotalItems,
  });

  if (normalizedCompletedItems === 0) {
    return 0;
  }

  if (normalizedCompletedItems >= normalizedTotalItems) {
    return MAX_PERCENT;
  }

  const roundedPercent = Math.round((normalizedCompletedItems / normalizedTotalItems) * 100);

  return Math.min(Math.max(roundedPercent, MIN_VISIBLE_STARTED_PERCENT), MAX_INCOMPLETE_PERCENT);
}

/**
 * Estimates course completion from generated chapter sizes because later
 * chapters often exist before their lesson rows have been generated.
 */
export function calculateCourseContinueProgressPercent({
  chapters,
}: {
  chapters: CourseContinueProgressChapter[];
}) {
  return calculateProgressPercent({
    completedItems: countCompletedLessons({ chapters }),
    totalItems: estimateCourseTotalLessons({ chapters }),
  });
}

/**
 * Counts cannot be negative in the database, but this helper keeps stale or
 * hand-built test inputs from leaking impossible values into the percentage.
 */
function normalizeCount({ value }: { value: number }) {
  return Math.max(Math.round(value), 0);
}

/**
 * Completed progress must never exceed the denominator shown to learners,
 * otherwise stale duplicate progress rows could display more than 100%.
 */
function clampCompletedItems({
  completedItems,
  totalItems,
}: {
  completedItems: number;
  totalItems: number;
}) {
  return Math.min(normalizeCount({ value: completedItems }), totalItems);
}

/**
 * Course completion is lesson-based, so the numerator is the visible completed
 * lessons from every published chapter row.
 */
function countCompletedLessons({ chapters }: { chapters: CourseContinueProgressChapter[] }) {
  return sumCounts({ values: chapters.map((chapter) => getCompletedLessonCount(chapter)) });
}

/**
 * Course progress should use the actual visible lesson count after every
 * chapter is generated, and only estimate while the course still has pending
 * chapters.
 */
function estimateCourseTotalLessons({ chapters }: { chapters: CourseContinueProgressChapter[] }) {
  if (areAllChaptersGenerated({ chapters })) {
    return countTotalLessons({ chapters });
  }

  return estimateTotalLessonsFromGeneratedChapters({ chapters });
}

/**
 * Generated chapters are the best sample for future chapter size because their
 * lesson lists have already reached the user-facing shape.
 */
function estimateTotalLessonsFromGeneratedChapters({
  chapters,
}: {
  chapters: CourseContinueProgressChapter[];
}) {
  const generatedChapters = chapters.filter((chapter) => isGeneratedChapter(chapter));
  const actualLessonTotal = countTotalLessons({ chapters });
  const generatedLessonTotal = countTotalLessons({ chapters: generatedChapters });

  if (generatedChapters.length === 0 || generatedLessonTotal === 0) {
    return actualLessonTotal;
  }

  const estimatedLessonTotal = Math.round(
    (generatedLessonTotal / generatedChapters.length) * chapters.length,
  );

  return Math.max(actualLessonTotal, estimatedLessonTotal);
}

/**
 * A generated chapter has completed its chapter-generation workflow, so its
 * visible lesson count is stable enough to use in the course estimate.
 */
function isGeneratedChapter(chapter: CourseContinueProgressChapter) {
  return chapter.generationStatus === GENERATED_CHAPTER_STATUS;
}

/**
 * The denominator uses visible lesson totals, including zero for generated
 * chapters where the learner's filters hide every lesson.
 */
function countTotalLessons({ chapters }: { chapters: CourseContinueProgressChapter[] }) {
  return sumCounts({ values: chapters.map((chapter) => getTotalLessonCount(chapter)) });
}

/**
 * Mapping through a named helper keeps the lesson-count normalization rule
 * reusable between actual totals and generated-chapter samples.
 */
function getTotalLessonCount(chapter: CourseContinueProgressChapter) {
  return normalizeCount({ value: chapter.totalLessons });
}

/**
 * Completed lesson counts need their own accessor so the numerator and
 * denominator rules stay visibly separate.
 */
function getCompletedLessonCount(chapter: CourseContinueProgressChapter) {
  return normalizeCount({ value: chapter.completedLessons });
}

/**
 * Summing normalized counts in one helper keeps callers declarative and avoids
 * repeating reduce arithmetic throughout the progress rules.
 */
function sumCounts({ values }: { values: number[] }) {
  return values.reduce((total, value) => total + normalizeCount({ value }), 0);
}

/**
 * An empty chapter list should not be treated as fully generated; it has no
 * denominator, so callers should hide progress instead of showing 100%.
 */
function areAllChaptersGenerated({ chapters }: { chapters: CourseContinueProgressChapter[] }) {
  return chapters.length > 0 && chapters.every((chapter) => isGeneratedChapter(chapter));
}
