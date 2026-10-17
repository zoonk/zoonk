const MINUTES_PER_HOUR = 60;

/**
 * How long a chapter or course takes, from its lessons' estimates: its minutes under an hour,
 * beyond that whole hours, which its label says are "about", since each lesson's time is an
 * estimate. Server labels and the catalog's client cards both read it.
 */
export function getTotalDuration(totalMinutes: number): { hours: number } | { minutes: number } {
  if (totalMinutes < MINUTES_PER_HOUR) {
    return { minutes: totalMinutes };
  }

  return { hours: Math.round(totalMinutes / MINUTES_PER_HOUR) };
}
