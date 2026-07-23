const ACTIVITY_INTENSITY_LEVELS = 4;

/**
 * Activity uses relative bands so a learner can distinguish their quieter and
 * busier study days even when their personal lesson count is still small.
 */
export function getActivityCalendarIntensity({
  lessonCompletions,
  maximumLessonCompletions,
}: {
  lessonCompletions: number;
  maximumLessonCompletions: number;
}): number {
  if (lessonCompletions === 0 || maximumLessonCompletions === 0) {
    return 0;
  }

  return Math.max(
    1,
    Math.ceil((lessonCompletions / maximumLessonCompletions) * ACTIVITY_INTENSITY_LEVELS),
  );
}
