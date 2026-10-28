import { MIN_DAILY_MINUTES } from "../plans/daily-minutes";

const MINUTES_STEP = 5;

const MAIN_GOAL_WEIGHT = 2;

export function splitDailyBudget({ budget, count }: { budget: number; count: number }): number[] {
  if (count <= 1) {
    return count === 1 ? [budget] : [];
  }

  const share = budget / (MAIN_GOAL_WEIGHT + count - 1);
  const other = Math.max(MIN_DAILY_MINUTES, Math.floor(share / MINUTES_STEP) * MINUTES_STEP);
  const main = Math.max(MIN_DAILY_MINUTES, budget - other * (count - 1));

  return [main, ...Array.from({ length: count - 1 }, () => other)];
}
