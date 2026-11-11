import "server-only";
import { type Goal } from "@zoonk/db";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import { readSavedPlan } from "../../../learner/facts/saved-plan";
import { type TodayFocusTest } from "../../../learner/placement/focus-test-contract";
import { readTodayFocusTest } from "../../../learner/placement/focus-test-summary";

/** Reads the plan only once the goal's own row allows the suggestion. */
export async function loadFocusTestSuggestion({
  goal,
  localDate,
  timeZone,
}: {
  goal: Goal;
  localDate: Date;
  timeZone?: string;
}): Promise<TodayFocusTest | null> {
  const suggestion = readTodayFocusTest({
    goal,
    localDate,
    timeShort: goal.targetDate !== null,
    timeZone: getAnswerTimeZone({ goal, timeZone }),
  });

  if (!suggestion) {
    return null;
  }

  const plan = await readSavedPlan(goal.userId, goal.id);
  const covered = plan?.coveredShare ?? null;

  return covered !== null && covered < 1 ? suggestion : null;
}
