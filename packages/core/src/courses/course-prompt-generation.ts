import { type CourseFormat, type CoursePrompt } from "@zoonk/db";
import { getLanguageSubtag } from "@zoonk/utils/locale";

const SAME_LANGUAGE_COURSE_ERROR = "Language course source and target languages must be different";
const UNSUPPORTED_COURSE_PROMPT_ERROR = "Course prompt is not generatable";

const REGULAR_COURSE_FORMATS = [
  "coding",
  "core",
  "practical",
  "instrument",
  "question",
] as const satisfies readonly CourseFormat[];

export type RegularCourseFormat = (typeof REGULAR_COURSE_FORMATS)[number];

type CoursePromptGenerationInput = Pick<
  CoursePrompt,
  "canonicalTitle" | "courseFormat" | "generationStatus" | "intent" | "language" | "targetLanguage"
>;

/**
 * Identifies formats that use the regular course pipeline. Keeping this rule in
 * Core lets routing and Workflow agree on generation support while preserving
 * the classified format on the prompt and generated course.
 */
export function isRegularCourseFormat(
  courseFormat: CourseFormat | null,
): courseFormat is RegularCourseFormat {
  return REGULAR_COURSE_FORMATS.some((format) => format === courseFormat);
}

/**
 * Treats every format that uses the regular generation pipeline as the same
 * reusable course identity. Other formats keep their exact stored identity so
 * language and future format-specific workflows remain isolated.
 */
export function getCompatibleCourseFormats(courseFormat: CourseFormat): CourseFormat[] {
  if (isRegularCourseFormat(courseFormat) && courseFormat !== "question") {
    return REGULAR_COURSE_FORMATS.filter((format) => format !== "question");
  }

  return [courseFormat];
}

/**
 * Language courses are only useful when the learner language and learned
 * language differ. Every entry point uses this shared check so an admin edit
 * cannot create a prompt that the generation workflow must reject later.
 */
function isSameLanguageCourseRequest(
  prompt: Pick<CoursePromptGenerationInput, "courseFormat" | "language" | "targetLanguage">,
): boolean {
  const language = getLanguageSubtag(prompt.language);

  return (
    prompt.courseFormat === "language" &&
    (prompt.targetLanguage === prompt.language ||
      (language !== null && language === getLanguageSubtag(prompt.targetLanguage ?? "")))
  );
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

  if (
    prompt.intent !== "learn" &&
    !(prompt.intent === "question" && prompt.courseFormat === "question")
  ) {
    return UNSUPPORTED_COURSE_PROMPT_ERROR;
  }

  if (isRegularCourseFormat(prompt.courseFormat)) {
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
