import { ensureLocaleSuffix, toSlug } from "@zoonk/utils/string";

export function getCourseSlugForTitle({
  language,
  title,
}: {
  language: string;
  title: string;
}): string {
  return ensureLocaleSuffix(toSlug(title), language);
}
