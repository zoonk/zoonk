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

/** Each goal typed together gets at least the minimum, so the day they share holds that much each. */
export function getLeastDailyBudget(count: number): number {
  return Math.max(1, count) * MIN_DAILY_MINUTES;
}

/**
 * The least day's time that gives the goal at `place` (the main one is 0) exactly `minutes`: a time
 * worked out for that goal alone, as the day the goals typed with it share.
 */
export function getBudgetForGoal({
  count,
  minutes,
  place,
}: {
  count: number;
  minutes: number;
  place: number;
}): number {
  const least = Math.max(minutes, getLeastDailyBudget(count));

  const budgets = Array.from(
    { length: Math.max(1, count) * (minutes / MINUTES_STEP) + 1 },
    (_, index) => least + index * MINUTES_STEP,
  );

  return budgets.find((budget) => splitDailyBudget({ budget, count })[place] === minutes) ?? least;
}
