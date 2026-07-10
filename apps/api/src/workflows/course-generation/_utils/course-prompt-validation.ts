import { type CoursePrompt } from "@zoonk/db";

const SAME_LANGUAGE_COURSE_ERROR = "Language course source and target languages must be different";
const UNSUPPORTED_COURSE_PROMPT_ERROR = "Course prompt is not generatable";

/**
 * Language courses are only useful when the learner language and learned
 * language differ. The main app prevents selecting the current locale, but the
 * API and workflow need the same rule because prompts can be started outside
 * that page.
 */
function isSameLanguageCourseRequest(
  prompt: Pick<CoursePrompt, "courseFormat" | "language" | "targetLanguage">,
): boolean {
  return prompt.courseFormat === "language" && prompt.targetLanguage === prompt.language;
}

/**
 * Explains why a persisted prompt cannot enter course generation. The database
 * also stores redirect, waitlist, unsafe, and invalid language records, so the
 * API route and workflow step share this check before creating courses.
 */
export function getCoursePromptGenerationError(prompt: CoursePrompt): string | null {
  if (!(prompt.canonicalTitle && prompt.generationStatus)) {
    return UNSUPPORTED_COURSE_PROMPT_ERROR;
  }

  if (prompt.intent !== "learn") {
    return UNSUPPORTED_COURSE_PROMPT_ERROR;
  }

  if (prompt.courseFormat === "core") {
    return prompt.targetLanguage === null ? null : UNSUPPORTED_COURSE_PROMPT_ERROR;
  }

  if (prompt.courseFormat !== "language") {
    return UNSUPPORTED_COURSE_PROMPT_ERROR;
  }

  if (!prompt.targetLanguage) {
    return UNSUPPORTED_COURSE_PROMPT_ERROR;
  }

  if (isSameLanguageCourseRequest(prompt)) {
    return SAME_LANGUAGE_COURSE_ERROR;
  }

  return null;
}
