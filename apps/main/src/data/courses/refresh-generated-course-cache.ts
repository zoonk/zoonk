"use server";

import {
  COURSE_LIST_CACHE_TAG,
  LANGUAGE_COURSE_LIST_CACHE_TAG,
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
} from "@/data/cache-tags";
import { prisma } from "@zoonk/db";
import { updateTag } from "next/cache";

/**
 * Detects the workflow's database completion before expiring the partial course
 * entries. Polling clients call this until the API workflow has committed the
 * complete curriculum, so the cache is cleared once instead of on every poll.
 */
export async function refreshGeneratedCourseCache({
  courseId,
}: {
  courseId: string;
}): Promise<boolean> {
  const course = await prisma.course.findUnique({ where: { id: courseId } });

  if (course?.generationStatus !== "completed") {
    return false;
  }

  updateTag(getCourseCacheTag(courseId));
  updateTag(getCourseCurriculumCacheTag(courseId));
  updateTag(COURSE_LIST_CACHE_TAG);
  updateTag(LANGUAGE_COURSE_LIST_CACHE_TAG);

  return true;
}
