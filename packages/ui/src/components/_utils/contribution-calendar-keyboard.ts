import { CONTRIBUTION_CALENDAR_DAYS_PER_WEEK } from "@zoonk/utils/contribution-calendar";

/**
 * Keeps arrow-key movement aligned with the calendar's column-major DOM order:
 * adjacent indexes move between weekdays, while seven indexes move between
 * matching weekdays in neighboring weeks.
 */
export function getContributionCalendarTargetIndex({
  currentIndex,
  key,
  totalDays,
}: {
  currentIndex: number;
  key: string;
  totalDays: number;
}): number | null {
  const weekdayIndex = currentIndex % CONTRIBUTION_CALENDAR_DAYS_PER_WEEK;

  if (key === "ArrowUp") {
    return weekdayIndex === 0 ? currentIndex : currentIndex - 1;
  }

  if (key === "ArrowDown") {
    const targetIndex = currentIndex + 1;

    return weekdayIndex === CONTRIBUTION_CALENDAR_DAYS_PER_WEEK - 1 || targetIndex >= totalDays
      ? currentIndex
      : targetIndex;
  }

  if (key === "ArrowLeft") {
    return currentIndex < CONTRIBUTION_CALENDAR_DAYS_PER_WEEK
      ? currentIndex
      : currentIndex - CONTRIBUTION_CALENDAR_DAYS_PER_WEEK;
  }

  if (key === "ArrowRight") {
    const targetIndex = currentIndex + CONTRIBUTION_CALENDAR_DAYS_PER_WEEK;

    return targetIndex >= totalDays ? currentIndex : targetIndex;
  }

  return null;
}
