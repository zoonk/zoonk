/** The run writing a test-out's questions, so its page follows it after the learner's tap. */
export const TEST_OUT_RUN_PARAM = "run";

/**
 * Set when the test was offered in today's session (after a second easy lesson in a row), so
 * leaving it goes back to Today, where the session goes on, instead of the chapter's page.
 */
export const TEST_OUT_FROM_SESSION_PARAM = "session";

/**
 * The test the learner sent (its `requestId`), set in place once its result shows: a reload, Back
 * or the link opened later shows that result as it was recorded instead of a new test.
 */
export const TEST_OUT_RESULT_PARAM = "result";
