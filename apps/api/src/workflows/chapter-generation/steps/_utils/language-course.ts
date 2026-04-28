import { prisma } from "@zoonk/db";

type CourseWithLanguageSignal = {
  id: string;
  targetLanguage: string | null;
};

const LANGUAGE_CATEGORY = "languages";

/**
 * Language lesson generation needs both signals so a partially edited course
 * with only a target language does not accidentally use the language curriculum path.
 */
export async function getLanguageCourseTargetLanguage({
  course,
}: {
  course: CourseWithLanguageSignal;
}): Promise<string | null> {
  if (!course.targetLanguage) {
    return null;
  }

  const languageCategory = await prisma.courseCategory.findUnique({
    where: {
      courseCategory: {
        category: LANGUAGE_CATEGORY,
        courseId: course.id,
      },
    },
  });

  if (!languageCategory) {
    return null;
  }

  return course.targetLanguage;
}
