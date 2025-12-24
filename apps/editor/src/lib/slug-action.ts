"use server";

import { courseSlugExists } from "@zoonk/core/courses/slug";
import { toSlug } from "@zoonk/utils/string";

export async function checkSlugExists({
  language,
  orgSlug,
  slug,
}: {
  language: string;
  orgSlug: string;
  slug: string;
}): Promise<boolean> {
  if (!slug.trim()) {
    return false;
  }

  return courseSlugExists({ language, orgSlug, slug: toSlug(slug) });
}
