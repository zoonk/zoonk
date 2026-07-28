/**
 * Matches the persisted course, chapter, lesson, and prompt language columns.
 * Public inputs must reject longer BCP 47 tags before they reach AI or Prisma.
 */
export const COURSE_LANGUAGE_MAX_LENGTH = 10;

/**
 * Keeps course topics concise enough to classify reliably while matching the
 * maximum already enforced by Main's course prompt input.
 */
export const COURSE_PROMPT_MAX_LENGTH = 128;
