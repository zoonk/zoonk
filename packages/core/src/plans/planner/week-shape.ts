const SUNDAY = 0;
const SATURDAY = 6;
const DAYS_PER_WEEK = 7;
const WEEKEND = [SUNDAY, SATURDAY];

const WEEKDAYS = Array.from({ length: DAYS_PER_WEEK }, (_, day) => day).filter(
  (day) => !WEEKEND.includes(day),
);

/** A plan's week as the plan editor asks it, Sunday first like the plan counts weekdays. */
export type WeekShape = {
  /** The week has both study weekdays and study weekend days, so the weekend can take its own time. */
  canDiffer: boolean;
  /** The weekdays (Monday to Friday) with study time. */
  weekdayDays: number[];
  /** A study weekday's time. */
  weekdays: number;
  /** The weekend's own time, or null when it takes the weekdays' time (or can't differ). */
  weekend: number | null;
  /** Saturday and Sunday, when they have study time. */
  weekendDays: number[];
};

/** Whether a weekday, counted from Sunday (0), is on the weekend. */
export function isWeekend(weekday: number): boolean {
  return WEEKEND.includes(weekday);
}

/** The most common of these times, the longer one on a tie; null for none. */
function getCommonMinutes(minutes: readonly number[]): number | null {
  const counts = minutes.map((value) => ({
    count: minutes.filter((other) => other === value).length,
    value,
  }));

  return counts.toSorted((a, b) => b.count - a.count || b.value - a.value)[0]?.value ?? null;
}

/**
 * Splits the week into weekdays and the weekend, as onboarding asks it: a study weekday's time (the
 * most common, so one shorter day doesn't count as the week's) and the weekend's own time when it
 * differs. `weekdayMinutes` null means every day takes `dailyMinutes`.
 */
export function getWeekShape({
  dailyMinutes,
  weekdayMinutes,
}: {
  dailyMinutes: number;
  weekdayMinutes: readonly number[] | null;
}): WeekShape {
  const minutesOf = (day: number) => (weekdayMinutes ? (weekdayMinutes[day] ?? 0) : dailyMinutes);
  const weekdayDays = WEEKDAYS.filter((day) => minutesOf(day) > 0);
  const weekendDays = WEEKEND.filter((day) => minutesOf(day) > 0);
  const weekdays = getCommonMinutes(weekdayDays.map((day) => minutesOf(day))) ?? dailyMinutes;
  const weekend = getCommonMinutes(weekendDays.map((day) => minutesOf(day)));
  const canDiffer = weekdayDays.length > 0 && weekendDays.length > 0;

  return {
    canDiffer,
    weekdayDays,
    weekdays,
    weekend: canDiffer && weekend !== weekdays ? weekend : null,
    weekendDays,
  };
}
