import { ensureLocaleSuffix, toSlug } from "@zoonk/utils/string";

/**
 * Course suggestions store the plain URL slug, while generated course rows use
 * the locale-aware slug that is protected by the organization unique index.
 * Deriving that value in one place keeps duplicate detection aligned with the
 * database write that can fail under concurrent workflow starts.
 */
export function getCourseSlugForTitle({
  language,
  title,
}: {
  language: string;
  title: string;
}): string {
  return ensureLocaleSuffix(toSlug(title), language);
}
