import "server-only";
import {
  type Course,
  type CourseStartRequest,
  getAiGenerationCourseWhere,
  prisma,
} from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { normalizeString } from "@zoonk/utils/string";

type LanguageCourseInput = { language: string; targetLanguage: string };

type LanguageCourseStartRequestInput = LanguageCourseInput & { title: string };

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
 * Creates the controlled request used by `/start/speak/[language]`. Language
 * courses still use the course-generation workflow, but the workflow input is a
 * language-scoped start request instead of an adapter row.
 */
async function getOrCreateLanguageCourseStartRequest({
  language,
  targetLanguage,
  title,
}: LanguageCourseStartRequestInput): Promise<CourseStartRequest> {
  const prompt = `Learn ${title}`;
  const normalizedPrompt = normalizeString(prompt);

  return prisma.courseStartRequest.upsert({
    create: {
      canonicalTitle: title,
      courseMode: "full",
      generationStatus: "pending",
      language,
      normalizedPrompt,
      prompt,
      scope: "language",
      targetLanguage,
    },
    update: {},
    where: { languageNormalizedPrompt: { language, normalizedPrompt } },
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
