export const COURSE_LIST_CACHE_TAG = "catalog-courses";
export const LANGUAGE_COURSE_LIST_CACHE_TAG = "language-course-list";

/** Identifies every cached view of one course without coupling callers to tag formatting. */
export function getCourseCacheTag(courseId: string): string {
  return `course:${courseId}`;
}

/** Identifies a course lookup even when the route does not resolve to a row yet. */
export function getCourseRouteCacheTag(input: { brandSlug: string; courseSlug: string }): string {
  return `course-route:${input.brandSlug}:${input.courseSlug}`;
}

/** Identifies cached chapter navigation and outlines owned by one course. */
export function getCourseCurriculumCacheTag(courseId: string): string {
  return `course-curriculum:${courseId}`;
}

/** Identifies every cached view of one chapter. */
export function getChapterCacheTag(chapterId: string): string {
  return `chapter:${chapterId}`;
}

/** Identifies a chapter lookup even when the route does not resolve to a row yet. */
export function getChapterRouteCacheTag(input: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
}): string {
  return `chapter-route:${input.brandSlug}:${input.courseSlug}:${input.chapterSlug}`;
}

/** Identifies cached lesson navigation and outlines owned by one chapter. */
export function getChapterLessonsCacheTag(chapterId: string): string {
  return `chapter-lessons:${chapterId}`;
}

/** Identifies every cached public and playable view of one lesson. */
export function getLessonCacheTag(lessonId: string): string {
  return `lesson:${lessonId}`;
}

/** Identifies a lesson lookup even when the route does not resolve to a row yet. */
export function getLessonRouteCacheTag(input: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
}): string {
  return `lesson-route:${input.brandSlug}:${input.courseSlug}:${input.chapterSlug}:${input.lessonSlug}`;
}

/** Identifies the current browser's private session entry for one signed-in user. */
export function getUserSessionCacheTag(userId: string): string {
  return `user-session:${userId}`;
}

/** Identifies cached progress data that must change after a learner write. */
export function getUserProgressCacheTag(userId: string): string {
  return `user-progress:${userId}`;
}
