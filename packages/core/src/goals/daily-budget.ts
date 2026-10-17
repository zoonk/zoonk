import { MIN_DAILY_MINUTES } from "../plans/planner/plan-state";

const MINUTES_STEP = 5;

/** The main goal gets twice the share of each other goal. */
const MAIN_GOAL_WEIGHT = 2;

/**
 * Splits one day's time between goals that share it ("ENEM and English"): the first goal is the
 * main one and gets twice each other goal's share. Other goals round down to 5 minutes, and the
 * main goal takes the rest, so the total stays the learner's time.
 */
export function splitDailyBudget({ budget, count }: { budget: number; count: number }): number[] {
  if (count <= 1) {
    return count === 1 ? [budget] : [];
  }

  const share = budget / (MAIN_GOAL_WEIGHT + count - 1);
  const other = Math.max(MIN_DAILY_MINUTES, Math.floor(share / MINUTES_STEP) * MINUTES_STEP);
  const main = Math.max(MIN_DAILY_MINUTES, budget - other * (count - 1));

  return [main, ...Array.from({ length: count - 1 }, () => other)];
}
