/** Smaller gaps are a graph's rough estimate; a chapter's worth still needs to be outlined. */
const MIN_STAND_IN_LESSONS = 4;

/** One shared lesson counts once; a complete published outline never implies extra chapters. */
export function countStandInLessons({
  lessons,
  outlined = false,
  taught,
}: {
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
  return missing >= MIN_STAND_IN_LESSONS ? missing : 0;
}
