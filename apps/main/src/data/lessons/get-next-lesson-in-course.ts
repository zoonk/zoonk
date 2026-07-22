import "server-only";
import { getCourseCurriculumCacheTag } from "@/data/cache-tags";
import {
  type NextLessonInCourse,
  getNextLessonInCourse as queryNextLessonInCourse,
} from "@zoonk/core/lessons/next-in-course";
import { type LessonKind } from "@zoonk/db";
import { cacheTag } from "next/cache";

type NextLessonInCourseInput = {
  chapterId: string;
  chapterPosition: number;
  courseId: string;
  excludedLessonKinds?: LessonKind[];
  lessonPosition: number;
};

/**
 * Normalizes hidden lesson kinds so the same structural next-lesson lookup
 * cannot occupy multiple persistent cache entries solely because of ordering.
 */
function normalizeInput(input: NextLessonInCourseInput): NextLessonInCourseInput {
  return { ...input, excludedLessonKinds: [...new Set(input.excludedLessonKinds)].toSorted() };
}

/** Shares each structural next-lesson lookup until the course curriculum changes. */
export async function getNextLessonInCourse(
  input: NextLessonInCourseInput,
): Promise<NextLessonInCourse | null> {
  "use cache";

  const normalizedInput = normalizeInput(input);
  cacheTag(getCourseCurriculumCacheTag(normalizedInput.courseId));

  return queryNextLessonInCourse(normalizedInput);
}
