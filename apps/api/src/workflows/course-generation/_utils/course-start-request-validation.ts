import { type CourseStartRequest } from "@zoonk/db";

const SAME_LANGUAGE_COURSE_ERROR = "Language course source and target languages must be different";

/**
 * Language courses are only useful when the learner language and learned
 * language differ. The main app prevents selecting the current locale, but the
 * API and workflow need the same rule because requests can be started outside
 * that page.
 */
function isSameLanguageCourseRequest(
  request: Pick<CourseStartRequest, "language" | "scope" | "targetLanguage">,
): boolean {
  return request.scope === "language" && request.targetLanguage === request.language;
}

/**
 * Explains why a persisted start request cannot enter course generation. The
 * database also stores redirect, waitlist, unsafe, and invalid language records,
 * so the API route and workflow step share this check before creating courses.
 */
export function getCourseStartRequestGenerationError(request: CourseStartRequest): string | null {
  if (!(request.canonicalTitle && request.generationStatus)) {
    return "Course start request is not generatable";
  }

  if (isSameLanguageCourseRequest(request)) {
    return SAME_LANGUAGE_COURSE_ERROR;
  }

  return null;
}
