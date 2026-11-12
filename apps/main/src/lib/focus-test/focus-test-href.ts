export const FOCUS_TEST_GOAL_PARAM = "goal";
export const FOCUS_TEST_STARTED_PARAM = "started";

/** The test's page after "Start the test" was pressed somewhere else: its first question. */
export const STARTED_FOCUS_TEST_HREF = `/focus-test?${FOCUS_TEST_STARTED_PARAM}=1` as const;

export function getGoalFocusTestHref(goalId: string) {
  return `/focus-test?${FOCUS_TEST_GOAL_PARAM}=${goalId}` as const;
}
