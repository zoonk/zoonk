import { addDays } from "./plan-calendar";

export const FITTING_DATE_TRIES = 7;

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
