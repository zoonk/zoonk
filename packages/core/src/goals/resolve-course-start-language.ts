import { getContentLocale } from "@zoonk/utils/locale";

type Edition = { id: string; language: string };

export function resolveCourseStartLanguage<CourseEdition extends Edition>({
  course,
  language,
}: {
  course: { editions: readonly CourseEdition[]; language: string };
  language?: string;
}) {
  if (
    !language ||
    (getContentLocale(language) ?? language) ===
      (getContentLocale(course.language) ?? course.language)
  ) {
    return { kind: "same" } as const;
  }

  const contentLanguage = getContentLocale(language) ?? language;

  const matches = course.editions.filter(
    (edition) => (getContentLocale(edition.language) ?? edition.language) === contentLanguage,
  );

  const [edition] = matches;

  return edition && matches.length === 1
    ? ({ edition, kind: "edition" } as const)
    : ({ kind: "learnerLanguage", language: contentLanguage } as const);
}
