export const MIN_DAILY_MINUTES = 5;

export const MAX_DAILY_MINUTES = 1440;

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

export const DAILY_TIME_CHOICES = [
  ...everyStep({ from: MIN_DAILY_MINUTES, step: SHORT_STEP, to: QUARTER_HOUR - SHORT_STEP }),
  ...everyStep({ from: QUARTER_HOUR, step: QUARTER_HOUR, to: QUARTER_HOURS_UNTIL }),
  ...everyStep({ from: QUARTER_HOURS_UNTIL + HALF_HOUR, step: HALF_HOUR, to: MAX_DAILY_MINUTES }),
];
