/** Floating-point sums of lesson minutes must not push a lesson to the next day. */
export const EPSILON = 1e-6;

/** The first day whose cumulative capacity reaches `needed`, or -1 when none does. */
export function findDayIndex({
  cumulative,
  needed,
}: {
  cumulative: readonly number[];
  needed: number;
}) {
  const search = (low: number, high: number): number => {
    if (low >= high) {
      return (cumulative[low] ?? 0) + EPSILON >= needed ? low : -1;
    }

    const middle = Math.floor((low + high) / 2);

    return (cumulative[middle] ?? 0) + EPSILON >= needed
      ? search(low, middle)
      : search(middle + 1, high);
  };

  return cumulative.length === 0 ? -1 : search(0, cumulative.length - 1);
}

/**
 * `findDayIndex` for a unit placed after the one that landed on day `from`: what it needs only
 * grows, so no day before `from` reaches it. The search gallops from there (a step, then twice as
 * many) instead of searching every day for each unit: a real-size exam places thousands of units,
 * many times per plan, and each lands on or near the day before it.
 */
export function findDayIndexFrom({
  cumulative,
  from,
  needed,
}: {
  cumulative: readonly number[];
  from: number;
  needed: number;
}): number {
  const last = cumulative.length - 1;

  if (from < 0 || from > last) {
    return -1;
  }

  /** Most units fit this day or the next; neither needs the galloping search's closures. */
  if ((cumulative[from] ?? 0) + EPSILON >= needed) {
    return from;
  }

  if (from === last) {
    return -1;
  }

  if ((cumulative[from + 1] ?? 0) + EPSILON >= needed) {
    return from + 1;
  }

  const reaches = (day: number) => (cumulative[day] ?? 0) + EPSILON >= needed;

  const search = (low: number, high: number): number => {
    if (low >= high) {
      return low;
    }

    const middle = Math.floor((low + high) / 2);
    return reaches(middle) ? search(low, middle) : search(middle + 1, high);
  };

  const gallop = (low: number, step: number): number => {
    const high = Math.min(last, low + step - 1);

    if (reaches(high)) {
      return search(low, high);
    }

    return high === last ? -1 : gallop(high + 1, step * 2);
  };

  return gallop(from + 1, 2);
}

/**
 * Whether a day's lesson minutes leave room for new work. A day whose minutes all go to fixed
 * events (a mock, the week's checkpoint on a day as short as it) has none, though the plan's study
 * time reaches it: a phase challenge never leads it (see `canHoldPhaseChallenge`).
 */
export function isLessonRoom(capacity: number): boolean {
  return capacity > EPSILON;
}

/**
 * The first day from `from` with lesson minutes of its own (see `isLessonRoom`), or -1 when none
 * is left.
 */
export function findLessonDayFrom({
  cumulative,
  from,
}: {
  cumulative: readonly number[];
  from: number;
}): number {
  if (from < 0) {
    return -1;
  }

  for (let dayIndex = from; dayIndex < cumulative.length; dayIndex += 1) {
    if (isLessonRoom((cumulative[dayIndex] ?? 0) - (cumulative[dayIndex - 1] ?? 0))) {
      return dayIndex;
    }
  }

  return -1;
}
