export const FOCUS_TEST_GOAL_PARAM = "goal";

export function getGoalFocusTestHref(goalId: string) {
  return `/focus-test?${FOCUS_TEST_GOAL_PARAM}=${goalId}` as const;
}
