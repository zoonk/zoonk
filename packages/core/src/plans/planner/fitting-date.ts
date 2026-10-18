import { addDays } from "./plan-calendar";

/** Days past the plan's end without a date the search for the earliest fitting date tries. */
export const FITTING_DATE_TRIES = 7;

/**
 * The earliest date the learner's time covers everything in depth by (`fitsBy`): from the day
 * they'd finish it all without a date (`end`), a day at a time, since a date is a day the plan
 * counts down to and its lessons end before it. Null when none of the tries does.
 */
export function findFittingDate({
  end,
  fitsBy,
}: {
  end: Date | null;
  fitsBy: (targetDate: Date) => boolean;
}): Date | null {
  if (!end) {
    return null;
  }

  const dates = Array.from({ length: FITTING_DATE_TRIES }, (_, index) => addDays(end, index));
  return dates.find((date) => fitsBy(date)) ?? null;
}
