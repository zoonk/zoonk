import { afterEach, beforeEach } from "vitest";

let timedOut: string | null = null;

/**
 * Vitest can't stop a timed-out test (https://vitest.dev/guide/recipes/cancellable), which then moves
 * the clock, mocks and rows of later files in its worker, so every later test there skips.
 */
export function skipAfterTimeout(): void {
  beforeEach(({ skip }) => {
    if (timedOut) {
      skip(`"${timedOut}" timed out and may still be running in this worker`);
    }
  });

  afterEach(({ signal, task }) => {
    if (signal.aborted) {
      timedOut ??= task.fullName;
    }
  });
}
