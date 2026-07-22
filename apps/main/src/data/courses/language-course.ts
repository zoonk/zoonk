import "server-only";
import { LANGUAGE_COURSE_LIST_CACHE_TAG } from "@/data/cache-tags";
import { type AiCourseHref, getAiCourseHref } from "@/data/courses/course-href";
import { type Course, type CoursePrompt, getAiGenerationCourseWhere, prisma } from "@zoonk/db";
import {
  type TTSSupportedLanguageCode,
  TTS_SUPPORTED_LANGUAGE_CODES,
  isTTSSupportedLanguage,
} from "@zoonk/utils/languages";
import { normalizeString } from "@zoonk/utils/string";
import { cacheTag } from "next/cache";

type LanguageCourseInput = { language: string; targetLanguage: string };

type CompletedLanguageCourseHrefEntry = readonly [TTSSupportedLanguageCode, AiCourseHref];

type LanguageCoursePromptInput = LanguageCourseInput & { title: string };

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
      format: "language",
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
  "use cache";
  cacheTag(LANGUAGE_COURSE_LIST_CACHE_TAG);

  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "asc" },
    where: getAiGenerationCourseWhere({
      format: "language",
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
 * Confirms that a cached prompt already has every field required by the
 * controlled language workflow. A matching target can be reused in any
 * generation state, while incomplete public classifications must be promoted
 * before the generation page receives them.
 */
function isGeneratableLanguageCoursePrompt({
  coursePrompt,
  targetLanguage,
}: {
  coursePrompt: CoursePrompt;
  targetLanguage: string;
}): boolean {
  return Boolean(
    coursePrompt.canonicalTitle &&
    coursePrompt.courseFormat === "language" &&
    coursePrompt.generationStatus &&
    coursePrompt.intent === "learn" &&
    coursePrompt.targetLanguage === targetLanguage,
  );
}

/**
 * Creates the controlled prompt used by `/start/speak/[language]`. Language
 * courses still use the course-generation workflow. A public `/start/learn`
 * visit can reserve the same prompt cache key first, so an unstarted row is
 * promoted in place while a linked or running row is never repurposed.
 */
async function getOrCreateLanguageCoursePrompt({
  language,
  targetLanguage,
  title,
}: LanguageCoursePromptInput): Promise<CoursePrompt> {
  const prompt = `Learn ${title}`;
  const normalizedPrompt = normalizeString(prompt);

  const languageCoursePrompt = {
    canonicalTitle: title,
    courseFormat: "language" as const,
    generationStatus: "pending" as const,
    intent: "learn" as const,
    language,
    normalizedPrompt,
    prompt,
    targetLanguage,
  };

  await prisma.coursePrompt.createMany({ data: languageCoursePrompt, skipDuplicates: true });

  const cachedPrompt = await prisma.coursePrompt.findUniqueOrThrow({
    where: { languageNormalizedPrompt: { language, normalizedPrompt } },
  });

  if (isGeneratableLanguageCoursePrompt({ coursePrompt: cachedPrompt, targetLanguage })) {
    return cachedPrompt;
  }

  await prisma.coursePrompt.updateMany({
    data: languageCoursePrompt,
    where: {
      courseId: null,
      generationRunId: null,
      generationStatus: null,
      id: cachedPrompt.id,
      targetLanguage: null,
    },
  });

  const languagePrompt = await prisma.coursePrompt.findUniqueOrThrow({
    where: { id: cachedPrompt.id },
  });

  if (isGeneratableLanguageCoursePrompt({ coursePrompt: languagePrompt, targetLanguage })) {
    return languagePrompt;
  }

  throw new Error("Existing course prompt is incompatible with this language course");
}

/**
 * Reuses or creates the controlled prompt the course-generation workflow uses
 * for language courses. The prompt stores the target language directly, so the
 * generation path no longer needs an adapter row between `/start/speak` and the
 * workflow.
 */
export async function getOrCreateLanguageCoursePromptRequest({
  language,
  targetLanguage,
  title,
}: LanguageCoursePromptInput) {
  if (!isTTSSupportedLanguage(targetLanguage)) {
    throw new Error(`Unsupported TTS language: ${targetLanguage}`);
  }

  return getOrCreateLanguageCoursePrompt({ language, targetLanguage, title });
}
