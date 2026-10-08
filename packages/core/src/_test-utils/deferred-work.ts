import { after } from "next/server";
import { vi } from "vitest";

/**
 * Runs the work capabilities defer with `after` right away, through the `next/server` mock in
 * `setup-tests.ts`, and returns a function that waits for all of it, so a test can check what
 * happens after the response.
 */
export function runDeferredWork(): () => Promise<void> {
  const pending: Promise<unknown>[] = [];

  vi.mocked(after).mockImplementation((task) => {
    pending.push(typeof task === "function" ? Promise.resolve(task()) : task);
  });

  return async () => {
    await Promise.all(pending.splice(0));
  };
}
