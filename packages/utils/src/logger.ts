import { isBlockedTestCall } from "./blocked-test-call";

function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * Reports a failure, except in Vitest, where tests assert what failed, and except a model call the
 * test kill switch stopped: E2E has no model, so every such call fails by design, and reporting it
 * would bury the failures that matter.
 */
export function logError(...args: unknown[]): void {
  if (!isTestEnvironment() && !args.some((arg) => isBlockedTestCall(arg))) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
}

export function logInfo(...args: unknown[]): void {
  if (!isTestEnvironment()) {
    // eslint-disable-next-line no-console
    console.info(...args);
  }
}
