import "server-only";
import { listCompletedLanguageCourses } from "@zoonk/core/courses/language";
import { type TTSSupportedLanguageCode } from "@zoonk/utils/languages";
import { type AiCourseHref, getAiCourseHref } from "./course-href";

type CompletedLanguageCourseHrefEntry = readonly [TTSSupportedLanguageCode, AiCourseHref];

export type CompletedLanguageCourseHrefs = Partial<Record<TTSSupportedLanguageCode, AiCourseHref>>;

/**
 * Converts a route-neutral course target into the web destination shown by the
 * language picker.
 */
function getCompletedLanguageCourseHrefEntry({
  course,
  targetLanguage,
}: Awaited<
  ReturnType<typeof listCompletedLanguageCourses>
>[number]): CompletedLanguageCourseHrefEntry {
  return [targetLanguage, getAiCourseHref(course)];
}

/**
 * Maps the shared completed-course resources to main's AI-brand routes.
 */
export async function getCompletedLanguageCourseHrefs({
  language,
}: {
  language: string;
}): Promise<CompletedLanguageCourseHrefs> {
  const courses = await listCompletedLanguageCourses({ language });
  return Object.fromEntries(courses.map((course) => getCompletedLanguageCourseHrefEntry(course)));
}
