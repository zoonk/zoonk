"use server";

import { COURSE_LIST_CACHE_TAG, LANGUAGE_COURSE_LIST_CACHE_TAG } from "@/data/cache-tags";
import { revalidatePath, updateTag } from "next/cache";

export async function invalidateGeneratedCourse(destinationHref: string): Promise<void> {
  revalidatePath(destinationHref);
  updateTag(COURSE_LIST_CACHE_TAG);
  updateTag(LANGUAGE_COURSE_LIST_CACHE_TAG);
}
