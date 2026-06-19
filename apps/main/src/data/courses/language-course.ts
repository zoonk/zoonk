import "server-only";
import { type Course, type CourseSuggestion, getAiGenerationCourseWhere, prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { AI_ORG_SLUG } from "@zoonk/utils/org";

type LanguageCourseInput = { language: string; targetLanguage: string };

type LanguageCourseSuggestionInput = LanguageCourseInput & { description: string; title: string };
type LanguageCourseHref = `/b/${typeof AI_ORG_SLUG}/c/${string}`;

function getLanguageCourseSuggestionSlug(targetLanguage: string): string {
  return `language-${targetLanguage}`;
}

/**
 * Finds the existing public AI language course before we create any workflow
 * input. Language courses have one stable identity per learner language and
 * target language, so this direct lookup avoids starting generation just to
 * discover a course that already exists.
 */
export async function getCompletedLanguageCourse({
  language,
  targetLanguage,
}: LanguageCourseInput): Promise<Course | null> {
  return prisma.course.findFirst({
    orderBy: { createdAt: "desc" },
    where: getAiGenerationCourseWhere({
      generationStatus: "completed",
      isPublished: true,
      language,
      targetLanguage,
    }),
  });
}

/**
 * Reuses the controlled language-start suggestion for the same target language,
 * or creates the row the current course-generation workflow already knows how
 * to process. The slug is the stable boundary here because generic prompt
 * suggestions can also have a target language.
 */
export async function getOrCreateLanguageCourseSuggestion({
  description,
  language,
  targetLanguage,
  title,
}: LanguageCourseSuggestionInput): Promise<CourseSuggestion> {
  if (!isTTSSupportedLanguage(targetLanguage)) {
    throw new Error(`Unsupported TTS language: ${targetLanguage}`);
  }

  const slug = getLanguageCourseSuggestionSlug(targetLanguage);

  const existing = await prisma.courseSuggestion.findUnique({
    where: { languageSlug: { language, slug } },
  });

  if (existing) {
    return existing;
  }

  return prisma.courseSuggestion.create({
    data: { description, language, slug, targetLanguage, title },
  });
}

/**
 * Converts a completed language course into the public catalog URL that the
 * language start redirect can use without importing app route helpers.
 */
export function getLanguageCourseHref(course: Pick<Course, "slug">): LanguageCourseHref {
  return `/b/${AI_ORG_SLUG}/c/${course.slug}`;
}
