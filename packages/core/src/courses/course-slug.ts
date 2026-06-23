import { ensureLocaleSuffix, toSlug } from "@zoonk/utils/string";

/**
 * Generated course identity is keyed by the canonical title plus learner
 * locale. English keeps the plain canonical slug, while other locales append
 * the locale so translated courses do not collide with the English catalog.
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
