"use server";

import {
  COURSE_LIST_CACHE_TAG,
  LANGUAGE_COURSE_LIST_CACHE_TAG,
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
} from "@zoonk/core/cache-tags";
import { getCourseGenerationStatus } from "@zoonk/core/courses/get-generation-status";
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
  const generationStatus = await getCourseGenerationStatus({ courseId });

  if (generationStatus !== "completed") {
    return false;
  }

  updateTag(getCourseCacheTag(courseId));
  updateTag(getCourseCurriculumCacheTag(courseId));
  updateTag(COURSE_LIST_CACHE_TAG);
  updateTag(LANGUAGE_COURSE_LIST_CACHE_TAG);

  return true;
}
