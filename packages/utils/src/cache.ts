const CACHE_TAG_LIMIT = 256;

export function cacheTagCourse({ courseId }: { courseId: number }) {
  return `course:${courseId}`.slice(0, CACHE_TAG_LIMIT);
}

export function cacheTagOrgCourses({ orgSlug }: { orgSlug: string }) {
  return `org-courses:${orgSlug}`.slice(0, CACHE_TAG_LIMIT);
}
