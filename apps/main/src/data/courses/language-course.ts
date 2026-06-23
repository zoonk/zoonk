import "server-only";
import { type Course, getAiGenerationCourseWhere, prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getOrCreateLanguageCourseStartRequest } from "./course-start-request";

type LanguageCourseInput = { language: string; targetLanguage: string };

type LanguageCourseStartRequestInput = LanguageCourseInput & { title: string };
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
 * Reuses or creates the controlled request the course-generation workflow uses
 * for language courses. The request stores the target language directly, so the
 * generation path no longer needs an adapter row between `/start/speak` and the
 * workflow.
 */
export async function getOrCreateLanguageCourseRequest({
  language,
  targetLanguage,
  title,
}: LanguageCourseStartRequestInput) {
  if (!isTTSSupportedLanguage(targetLanguage)) {
    throw new Error(`Unsupported TTS language: ${targetLanguage}`);
  }

  return getOrCreateLanguageCourseStartRequest({ language, targetLanguage, title });
}

/**
 * Converts a completed language course into the public catalog URL that the
 * language start redirect can use without importing app route helpers.
 */
export function getLanguageCourseHref(course: Pick<Course, "slug">): LanguageCourseHref {
  return `/b/${AI_ORG_SLUG}/c/${course.slug}`;
}
