import { isBlockedTestCall } from "./blocked-test-call";

function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * Skips Vitest, whose tests assert what failed, and model calls the test kill switch stopped, which
 * fail by design in E2E.
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
