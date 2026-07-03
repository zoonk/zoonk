import { type CourseChapter } from "@/data/chapters/list-course-chapters";

const MAX_COURSE_PATH_GROUPS = 4;
const INTRODUCTION_COURSE_PATH_GROUP_WEIGHT = 10;
const BASICS_COURSE_PATH_GROUP_WEIGHT = 25;
const INTERMEDIATE_COURSE_PATH_GROUP_WEIGHT = 40;
const ADVANCED_COURSE_PATH_GROUP_WEIGHT = 25;

const COURSE_PATH_GROUP_WEIGHTS = [
  INTRODUCTION_COURSE_PATH_GROUP_WEIGHT,
  BASICS_COURSE_PATH_GROUP_WEIGHT,
  INTERMEDIATE_COURSE_PATH_GROUP_WEIGHT,
  ADVANCED_COURSE_PATH_GROUP_WEIGHT,
] as const;

export type CoursePathGroup = { chapters: CourseChapter[]; startNumber: number; title: string };

/**
 * Returns the section count for the landing-page curriculum preview. The page
 * should present the same four-stage mental model whenever possible, but the
 * count cannot exceed the number of chapters because empty sections make short
 * edge-case courses look unfinished.
 */
function getCoursePathGroupCount({ chapterCount }: { chapterCount: number }) {
  return Math.min(MAX_COURSE_PATH_GROUPS, chapterCount);
}

/**
 * Keeps a computed boundary inside the only range that can leave at least one
 * chapter in the current section and every section after it. Weighted rounding
 * can otherwise round the introduction down to zero on very short courses.
 */
function clampCoursePathBoundary({
  boundary,
  boundaryIndex,
  chapterCount,
  groupCount,
}: {
  boundary: number;
  boundaryIndex: number;
  chapterCount: number;
  groupCount: number;
}) {
  const minimumBoundary = boundaryIndex + 1;
  const maximumBoundary = chapterCount - (groupCount - boundaryIndex - 1);

  return Math.min(maximumBoundary, Math.max(minimumBoundary, boundary));
}

/**
 * Converts the learning-curve weights into the first chapter index after each
 * group. Cumulative rounding keeps the sections close to the intended
 * introduction, basics, intermediate, and advanced ratio without changing the
 * order of the generated chapters. Boundary clamping keeps every visible group
 * populated when chapter counts are small.
 */
function getCoursePathGroupBoundaries({
  chapterCount,
  groupCount,
}: {
  chapterCount: number;
  groupCount: number;
}) {
  const weights = COURSE_PATH_GROUP_WEIGHTS.slice(0, groupCount);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);

  return weights.slice(0, -1).map((_, index) => {
    const completedWeight = weights
      .slice(0, index + 1)
      .reduce((total, weight) => total + weight, 0);

    return clampCoursePathBoundary({
      boundary: Math.round((chapterCount * completedWeight) / totalWeight),
      boundaryIndex: index,
      chapterCount,
      groupCount,
    });
  });
}

/**
 * Reads the previous boundary without using negative array indexes. The first
 * visual group must always start at chapter zero; `Array.at(-1)` would instead
 * read the final boundary and accidentally make the introduction empty.
 */
function getCoursePathGroupStartIndex({
  boundaries,
  index,
}: {
  boundaries: number[];
  index: number;
}) {
  if (index === 0) {
    return 0;
  }

  return boundaries[index - 1] ?? 0;
}

/**
 * Reads the next boundary for a group, falling back to the chapter count for
 * the final group so every chapter after the last boundary stays visible.
 */
function getCoursePathGroupEndIndex({
  boundaries,
  chapters,
  index,
}: {
  boundaries: number[];
  chapters: CourseChapter[];
  index: number;
}) {
  return boundaries[index] ?? chapters.length;
}

/**
 * Returns the chapters that belong in one visual course-path group. The
 * `startNumber` is one-based because the UI uses it for learner-facing chapter
 * numbering, while the slice boundaries stay zero-based for array access.
 */
function getCoursePathGroup({
  boundaries,
  chapters,
  index,
  title,
}: {
  boundaries: number[];
  chapters: CourseChapter[];
  index: number;
  title: string;
}): CoursePathGroup {
  const startIndex = getCoursePathGroupStartIndex({ boundaries, index });
  const endIndex = getCoursePathGroupEndIndex({ boundaries, chapters, index });

  return { chapters: chapters.slice(startIndex, endIndex), startNumber: startIndex + 1, title };
}

/**
 * Empty groups are defensive cleanup for unusual chapter counts or future
 * threshold changes. The current thresholds keep every rendered group populated,
 * but filtering here prevents an empty disclosure row if those constants move.
 */
function hasCoursePathGroupChapters(group: CoursePathGroup) {
  return group.chapters.length > 0;
}

/**
 * Long AI-generated courses can look intimidating if every chapter is visible
 * at once. Weighted groups keep every title accessible while making the path
 * feel like a real learning curve: a short introduction, a larger basics stage,
 * the deepest intermediate section, and a focused advanced finish.
 */
export function getCoursePathGroups({
  chapters,
  labels,
}: {
  chapters: CourseChapter[];
  labels: string[];
}): CoursePathGroup[] {
  const groupCount = getCoursePathGroupCount({ chapterCount: chapters.length });
  const boundaries = getCoursePathGroupBoundaries({ chapterCount: chapters.length, groupCount });

  return Array.from({ length: groupCount }, (_, index) =>
    getCoursePathGroup({
      boundaries,
      chapters,
      index,
      title: labels.at(index) ?? labels.at(-1) ?? "",
    }),
  ).filter((group) => hasCoursePathGroupChapters(group));
}
