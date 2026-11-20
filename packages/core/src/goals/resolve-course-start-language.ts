import { getContentLocale } from "@zoonk/utils/locale";

type Edition = { id: string; language: string };

export function supportsCourseEditions(course: { userId: string | null; visibility: string }) {
  return !course.userId && course.visibility === "public";
}

export function resolveCourseStartLanguage<CourseEdition extends Edition>({
  course,
  language,
}: {
  course: {
    editions: readonly CourseEdition[];
    language: string;
    targetLanguage: string | null;
    visibility: string;
    userId: string | null;
  };
  language?: string;
}) {
  const contentLanguage = language && (getContentLocale(language) ?? language);

  if (
    !contentLanguage ||
    !supportsCourseEditions(course) ||
    [course.language, course.targetLanguage].some(
      (tag) => tag && (getContentLocale(tag) ?? tag) === contentLanguage,
    )
  ) {
    return { kind: "same" } as const;
  }

  const matches = course.editions.filter(
    (edition) => (getContentLocale(edition.language) ?? edition.language) === contentLanguage,
  );

  const [edition] = matches;

  return edition && matches.length === 1
    ? ({ edition, kind: "edition" } as const)
    : ({ kind: "learnerLanguage", language: contentLanguage } as const);
}
