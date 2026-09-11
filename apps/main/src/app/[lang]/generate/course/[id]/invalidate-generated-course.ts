"use server";

import { COURSE_LIST_CACHE_TAG, LANGUAGE_COURSE_LIST_CACHE_TAG } from "@zoonk/core/cache-tags";
import { DEFAULT_LOCALE, isValidLocale } from "@zoonk/utils/locale";
import { SITE_URL } from "@zoonk/utils/url";
import { revalidatePath, updateTag } from "next/cache";

export async function invalidateGeneratedCourse(destinationHref: string): Promise<void> {
  const pathname = new URL(destinationHref, SITE_URL).pathname;
  revalidatePath(pathname);

  // Cache tags use the internal locale route, including English's rewrite.
  if (!isValidLocale(pathname.split("/")[1] ?? "")) {
    revalidatePath(`/${DEFAULT_LOCALE}${pathname}`);
  }

  updateTag(COURSE_LIST_CACHE_TAG);
  updateTag(LANGUAGE_COURSE_LIST_CACHE_TAG);
}
