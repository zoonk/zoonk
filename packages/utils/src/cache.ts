const CACHE_TAG_LIMIT = 256;

export function cacheTagChapter({ chapterSlug }: { chapterSlug: string }) {
  return `chapter:${chapterSlug}`.slice(0, CACHE_TAG_LIMIT);
}

export function cacheTagCourse({ courseSlug }: { courseSlug: string }) {
  return `course:${courseSlug}`.slice(0, CACHE_TAG_LIMIT);
}

export function cacheTagLesson({ lessonSlug }: { lessonSlug: string }) {
  return `lesson:${lessonSlug}`.slice(0, CACHE_TAG_LIMIT);
}

export function cacheTagOrgCourses({ orgSlug }: { orgSlug: string }) {
  return `org-courses:${orgSlug}`.slice(0, CACHE_TAG_LIMIT);
}

export function cacheTagCoursesList({ language }: { language: string }) {
  return `courses-list:${language}`.slice(0, CACHE_TAG_LIMIT);
}
