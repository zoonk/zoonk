const MIN_STAND_IN_LESSONS = 4;

/** The most lessons one chapter written ahead for a topic holds. */
export const CHAPTER_LESSONS = 10;

export function countStandInLessons({
  includeShortRemainder = false,
  lessons,
  outlined = false,
  taught,
}: {
  includeShortRemainder?: boolean;
  lessons: number;
  outlined?: boolean;
  taught: number;
}): number {
  if (outlined) {
    return 0;
  }

  if (taught === 0) {
    return lessons;
  }

  const missing = lessons - taught;
  return includeShortRemainder || missing >= MIN_STAND_IN_LESSONS ? Math.max(0, missing) : 0;
}
