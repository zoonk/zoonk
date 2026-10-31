const ACTIVITY_INTENSITY_LEVELS = 4;

/** Relative bands, so a learner tells quieter from busier days even while their counts are small. */
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
