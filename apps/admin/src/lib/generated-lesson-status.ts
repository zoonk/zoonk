export const generatedLessonFilters = ["failed", "missingAudio", "completed"] as const;

export type GeneratedLessonFilter = (typeof generatedLessonFilters)[number];

const defaultGeneratedLessonFilter: GeneratedLessonFilter = "failed";

/**
 * Generated lesson logs expose terminal generation states plus a derived queue
 * for completed lessons whose optional audio remains missing.
 */
export function parseGeneratedLessonFilter(
  status: string | string[] | undefined,
): GeneratedLessonFilter {
  const value = Array.isArray(status) ? status[0] : status;

  if (isGeneratedLessonFilter(value)) {
    return value;
  }

  return defaultGeneratedLessonFilter;
}

/**
 * Query params arrive as arbitrary strings, so the admin lesson list needs a
 * narrow runtime check before passing the status into Prisma.
 */
function isGeneratedLessonFilter(value: string | undefined): value is GeneratedLessonFilter {
  return generatedLessonFilters.some((filter) => filter === value);
}
