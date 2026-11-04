import { beforeEach } from "vitest";

let timedOut: { id: string; name: string } | null = null;

/**
 * Vitest can't stop a timed-out test (https://vitest.dev/guide/recipes/cancellable), which then moves
 * the clock, mocks and rows of later tests in its worker: they skip, and its own retries fail.
 */
export function skipAfterTimeout(): void {
  beforeEach(({ signal, skip, task }) => {
    if (timedOut?.id === task.id) {
      throw new Error("An earlier attempt timed out and may still be running");
    }

    if (timedOut) {
      skip(`"${timedOut.name}" timed out and may still be running in this worker`);
    }

    signal.addEventListener("abort", () => {
      timedOut ??= { id: task.id, name: task.fullName };
    });
  });
}
