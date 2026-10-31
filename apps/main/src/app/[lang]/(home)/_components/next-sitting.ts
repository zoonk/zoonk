import { addIsoDays } from "@zoonk/utils/calendar-day";

const YEAR_LENGTH = "yyyy".length;
const DAYS_PER_WEEK = 7;
const HALF_WEEK = 3;

/** Exams keep their weekday, so a later year's sitting is that weekday closest to the same date. */
function getSittingIn({ day, year }: { day: string; year: number }): string {
  const sitting = new Date(`${day}T00:00:00Z`);
  const sameDate = `${year}${day.slice(YEAR_LENGTH)}`;
  const weekday = new Date(`${sameDate}T00:00:00Z`).getUTCDay();
  const shift = (sitting.getUTCDay() - weekday + DAYS_PER_WEEK) % DAYS_PER_WEEK;

  return addIsoDays({ day: sameDate, days: shift > HALF_WEEK ? shift - DAYS_PER_WEEK : shift });
}

export function getNextSitting({ day, today }: { day: string; today: string }): string {
  if (day > today) {
    return day;
  }

  const year = Number(today.slice(0, YEAR_LENGTH));
  const thisYear = getSittingIn({ day, year });

  return thisYear > today ? thisYear : getSittingIn({ day, year: year + 1 });
}
