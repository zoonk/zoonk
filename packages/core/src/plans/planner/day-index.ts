export const EPSILON = 1e-6;

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
 * Gallops from `from` (a step, then twice as many): a real-size exam places thousands of units per
 * plan, each near the one before it.
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

export function isLessonRoom(capacity: number): boolean {
  return capacity > EPSILON;
}

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
