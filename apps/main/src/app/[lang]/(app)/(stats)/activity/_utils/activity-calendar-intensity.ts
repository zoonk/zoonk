const ACTIVITY_INTENSITY_LEVELS = 4;

/**
 * Relative bands, so a learner tells shorter from longer study days even while their minutes are few.
 * A learning day with no recorded time (older imported days) still shows the lightest studied shade.
 */
export function getActivityCalendarIntensity({
  maximumTimeSpentSeconds,
  studied,
  timeSpentSeconds,
}: {
  maximumTimeSpentSeconds: number;
  studied: boolean;
  timeSpentSeconds: number;
}): number {
  if (!studied) {
    return 0;
  }

  if (maximumTimeSpentSeconds === 0) {
    return 1;
  }

  return Math.max(
    1,
    Math.ceil((timeSpentSeconds / maximumTimeSpentSeconds) * ACTIVITY_INTENSITY_LEVELS),
  );
}
