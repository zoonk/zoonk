/** What the test kill switch says when it stops a model call before it leaves the process. */
export const BLOCKED_TEST_CALL = "AI Gateway calls are disabled during tests.";

/** Wrapped errors are followed this far: a cause chain that loops ends here. */
const MAX_CAUSES = 5;

function isBlockedWithin(error: unknown, depth: number): boolean {
  if (!(error instanceof Error) || depth > MAX_CAUSES) {
    return false;
  }

  return error.message === BLOCKED_TEST_CALL || isBlockedWithin(error.cause, depth + 1);
}

/**
 * Whether an error, or one it wraps, is a model call the test kill switch stopped. Tests have no
 * model, so every model behind it is stopped the same way: retrying, or trying another, only
 * fails again, and the failure is the one tests expect.
 */
export function isBlockedTestCall(error: unknown): boolean {
  return isBlockedWithin(error, 0);
}
