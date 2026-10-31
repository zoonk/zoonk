export const BLOCKED_TEST_CALL = "AI Gateway calls are disabled during tests.";

const MAX_CAUSES = 5;

function isBlockedWithin(error: unknown, depth: number): boolean {
  if (!(error instanceof Error) || depth > MAX_CAUSES) {
    return false;
  }

  return error.message === BLOCKED_TEST_CALL || isBlockedWithin(error.cause, depth + 1);
}

/** Tests stop every model the same way, so retrying or trying another model only fails again. */
export function isBlockedTestCall(error: unknown): boolean {
  return isBlockedWithin(error, 0);
}
