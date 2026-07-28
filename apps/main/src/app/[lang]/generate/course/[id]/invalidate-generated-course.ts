"use server";

import {
  COURSE_LIST_CACHE_TAG,
  LANGUAGE_COURSE_LIST_CACHE_TAG,
  getCourseRouteCacheTag,
} from "@zoonk/core/cache-tags";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { revalidatePath, updateTag } from "next/cache";

export async function invalidateGeneratedCourse(input: {
  courseSlug: string;
  destinationHref: string;
}): Promise<void> {
  revalidatePath(input.destinationHref);
  updateTag(getCourseRouteCacheTag({ brandSlug: AI_ORG_SLUG, courseSlug: input.courseSlug }));
  updateTag(COURSE_LIST_CACHE_TAG);
  updateTag(LANGUAGE_COURSE_LIST_CACHE_TAG);
}
