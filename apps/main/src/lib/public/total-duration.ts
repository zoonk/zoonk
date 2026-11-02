const MINUTES_PER_HOUR = 60;

export function getTotalDuration(totalMinutes: number): { hours: number } | { minutes: number } {
  if (totalMinutes < MINUTES_PER_HOUR) {
    return { minutes: totalMinutes };
  }

  return { hours: Math.round(totalMinutes / MINUTES_PER_HOUR) };
}
