const ACTIVITY_INTENSITY_LEVELS = 4;

/**
 * Activity uses relative bands so a learner can distinguish their quieter and
 * busier study days even when their own activity counts are still small.
 */
export function getActivityCalendarIntensity({
  activitiesCompleted,
  maximumActivitiesCompleted,
}: {
  activitiesCompleted: number;
  maximumActivitiesCompleted: number;
}): number {
  if (activitiesCompleted === 0 || maximumActivitiesCompleted === 0) {
    return 0;
  }

  return Math.max(
    1,
    Math.ceil((activitiesCompleted / maximumActivitiesCompleted) * ACTIVITY_INTENSITY_LEVELS),
  );
}
