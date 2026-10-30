import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "@zoonk/core/plans/daily-minutes";

const SHORT_STEP = 5;
const QUARTER_HOUR = 15;
const HALF_HOUR = 30;
const QUARTER_HOURS_UNTIL = 240;

function everyStep({ from, step, to }: { from: number; step: number; to: number }): number[] {
  return Array.from(
    { length: Math.floor((to - from) / step) + 1 },
    (_, index) => from + index * step,
  );
}

const DAILY_TIMES = [
  ...everyStep({ from: MIN_DAILY_MINUTES, step: SHORT_STEP, to: QUARTER_HOUR - SHORT_STEP }),
  ...everyStep({ from: QUARTER_HOUR, step: QUARTER_HOUR, to: QUARTER_HOURS_UNTIL }),
  ...everyStep({ from: QUARTER_HOURS_UNTIL + HALF_HOUR, step: HALF_HOUR, to: MAX_DAILY_MINUTES }),
];

export function getDailyTimes(...shown: (number | null)[]): number[] {
  const own = shown.filter((time) => time !== null);
  return [...new Set([...DAILY_TIMES, ...own])].toSorted((a, b) => a - b);
}
