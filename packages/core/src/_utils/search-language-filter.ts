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
