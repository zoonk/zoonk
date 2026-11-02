const SUNDAY = 0;
const SATURDAY = 6;
const DAYS_PER_WEEK = 7;
const WEEKEND = [SUNDAY, SATURDAY];

const WEEKDAYS = Array.from({ length: DAYS_PER_WEEK }, (_, day) => day).filter(
  (day) => !WEEKEND.includes(day),
);

export type WeekShape = {
  canDiffer: boolean;
  weekdayDays: number[];
  weekdays: number;
  weekend: number | null;
  weekendDays: number[];
};

export function isWeekend(weekday: number): boolean {
  return WEEKEND.includes(weekday);
}

function getCommonMinutes(minutes: readonly number[]): number | null {
  const counts = minutes.map((value) => ({
    count: minutes.filter((other) => other === value).length,
    value,
  }));

  return counts.toSorted((a, b) => b.count - a.count || b.value - a.value)[0]?.value ?? null;
}

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
