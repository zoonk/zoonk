import "server-only";
import { type AiCourseHref, getAiCourseHref } from "@/data/courses/course-href";
import {
  type Course,
  type CourseStartRequest,
  getAiGenerationCourseWhere,
  prisma,
} from "@zoonk/db";
import {
  type TTSSupportedLanguageCode,
  TTS_SUPPORTED_LANGUAGE_CODES,
  isTTSSupportedLanguage,
} from "@zoonk/utils/languages";
import { normalizeString } from "@zoonk/utils/string";

type LanguageCourseInput = { language: string; targetLanguage: string };

type CompletedLanguageCourseHrefEntry = readonly [TTSSupportedLanguageCode, AiCourseHref];

type LanguageCourseStartRequestInput = LanguageCourseInput & { title: string };

export type CompletedLanguageCourseHrefs = Partial<Record<TTSSupportedLanguageCode, AiCourseHref>>;

/**
 * Rechecks course target languages after Prisma returns rows because the query
 * filter guarantees the database shape, but TypeScript still sees a nullable
 * string. Keeping this guard local lets the batched list lookup return strongly
 * typed language keys without weakening the public type.
 */
function getSupportedCourseTargetLanguage(course: Course): TTSSupportedLanguageCode | null {
  if (!isTTSSupportedLanguage(course.targetLanguage)) {
    return null;
  }

  return course.targetLanguage;
}

/**
 * Converts a completed course row into the language picker lookup entry. Rows
 * without a supported target language are ignored so stale or manually edited
 * data cannot create invalid `/start/speak` options.
 */
function getCompletedLanguageCourseHrefEntry(course: Course): CompletedLanguageCourseHrefEntry[] {
  const targetLanguage = getSupportedCourseTargetLanguage(course);

  if (!targetLanguage) {
    return [];
  }

  return [[targetLanguage, getAiCourseHref(course)]];
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
 * Fetches completed language course destinations for the picker in one query
 * instead of doing one lookup per supported language. Sorting oldest to newest
 * means duplicate target-language rows collapse to the same latest-course
 * behavior used by `getCompletedLanguageCourse`.
 */
export async function getCompletedLanguageCourseHrefs({
  language,
}: {
  language: string;
}): Promise<CompletedLanguageCourseHrefs> {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "asc" },
    where: getAiGenerationCourseWhere({
      generationStatus: "completed",
      isPublished: true,
      language,
      targetLanguage: { in: [...TTS_SUPPORTED_LANGUAGE_CODES] },
    }),
  });

  return Object.fromEntries(
    courses.flatMap((course) => getCompletedLanguageCourseHrefEntry(course)),
  );
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
