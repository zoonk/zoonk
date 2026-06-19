import "server-only";
import { type Course, type CourseSuggestion, getAiGenerationCourseWhere, prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { AI_ORG_SLUG } from "@zoonk/utils/org";

type LanguageCourseInput = { language: string; targetLanguage: string };

type LanguageCourseSuggestionInput = LanguageCourseInput & { description: string; title: string };
type LanguageCourseHref = `/b/${typeof AI_ORG_SLUG}/c/${string}`;

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
 * Reuses any existing language suggestion for the same target language, or
 * creates the controlled suggestion row the current course-generation workflow
 * already knows how to process. This keeps language starts deterministic while
 * avoiding a new workflow API shape until the old suggestion boundary is fully
 * replaced.
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

  const existing = await prisma.courseSuggestion.findFirst({
    orderBy: { createdAt: "asc" },
    where: { language, targetLanguage },
  });

  if (existing) {
    return existing;
  }

  return prisma.courseSuggestion.create({
    data: { description, language, slug: `language-${targetLanguage}`, targetLanguage, title },
  });
}

/**
 * Converts a completed language course into the public catalog URL that the
 * language start redirect can use without importing app route helpers.
 */
export function getLanguageCourseHref(course: Pick<Course, "slug">): LanguageCourseHref {
  return `/b/${AI_ORG_SLUG}/c/${course.slug}`;
}
