export const SPLIT_LESSON_SLUG_MARKER = "--split--";

/**
 * Builds the stable slug used for a generated continuation lesson. The double
 * hyphen marker is reserved because normal lesson slugs collapse repeated
 * hyphens, so consumers can identify continuations without extra schema state.
 */
export function getSplitLessonSlug({
  partNumber,
  rootLessonId,
  slug,
}: {
  partNumber: number;
  rootLessonId: string;
  slug: string;
}): string {
  if (!Number.isInteger(partNumber) || partNumber < 2) {
    throw new Error("Split lesson part numbers must start at 2");
  }

  return `${slug}${SPLIT_LESSON_SLUG_MARKER}${rootLessonId}--${partNumber}`;
}

/**
 * Identifies generated continuation lessons through the reserved slug marker.
 * Any slug containing the marker is treated as internal continuation metadata,
 * including by SEO and generation consumers, so those policies cannot drift.
 */
export function isSplitLessonSlug(slug: string): boolean {
  return slug.includes(SPLIT_LESSON_SLUG_MARKER);
}
