import { type CoursePrompt } from "@zoonk/db";

const SAME_LANGUAGE_COURSE_ERROR = "Language course source and target languages must be different";
const UNSUPPORTED_COURSE_PROMPT_ERROR = "Course prompt is not generatable";

type CoursePromptGenerationInput = Pick<
  CoursePrompt,
  "canonicalTitle" | "courseFormat" | "generationStatus" | "intent" | "language" | "targetLanguage"
>;

/**
 * Language courses are only useful when the learner language and learned
 * language differ. Every entry point uses this shared check so an admin edit
 * cannot create a prompt that the generation workflow must reject later.
 */
function isSameLanguageCourseRequest(
  prompt: Pick<CoursePromptGenerationInput, "courseFormat" | "language" | "targetLanguage">,
): boolean {
  return prompt.courseFormat === "language" && prompt.targetLanguage === prompt.language;
}

/**
 * Explains why a persisted prompt cannot enter course generation. The database
 * also stores redirect, waitlist, unsafe, and invalid language records, so API
 * callers and admin mutations must share this check before requesting generation.
 */
export function getCoursePromptGenerationError(prompt: CoursePromptGenerationInput): string | null {
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
