import "server-only";
import { type CourseFormat } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCourseCacheTag, getCourseCurriculumCacheTag } from "../cache/tags";
import { getQuickTestMinutes } from "../language/level-test/level-test-contract";
import { loadCourseExam } from "./_utils/course-exam";
import { getCourseGoalKind } from "./_utils/course-goal-kind";

type QuickTestCourse = { format: CourseFormat; id: string; targetLanguage: string | null };

async function getCachedQuickTestMinutes(course: QuickTestCourse): Promise<number> {
  "use cache";
  cacheTag(getCourseCacheTag(course.id), getCourseCurriculumCacheTag(course.id));

  const facts = { format: course.format, targetLanguage: course.targetLanguage };

  // An exam only ever makes the start an exam goal, so only a language goal's start looks for one.
  const exam =
    getCourseGoalKind({ ...facts, hasExam: false }) === "language"
      ? await loadCourseExam(course.id)
      : null;

  return getQuickTestMinutes(getCourseGoalKind({ ...facts, hasExam: exam !== null }));
}

/** The quick test of the goal starting the course would make, which can be an exam the course is part of. */
export function getCourseQuickTestMinutes({
  format,
  id,
  targetLanguage,
}: QuickTestCourse): Promise<number> {
  return getCachedQuickTestMinutes({ format, id, targetLanguage });
}
