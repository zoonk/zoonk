/**
 * Search APIs can use language as either a ranking preference or a strict
 * filter. This helper keeps the strict-filter rule consistent for catalog
 * surfaces that must never show another language once a locale is known.
 */
export function getSearchLanguageFilter({
  filterByLanguage,
  language,
}: {
  filterByLanguage?: boolean;
  language?: string;
}) {
  if (!filterByLanguage || !language) {
    return {};
  }

  return { language };
}
