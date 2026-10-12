import { onTestFinished, vi } from "vitest";

/**
 * Stops the clock where the test starts, until it ends: a test that sets up today's work and then
 * reads today again reads the same day, even when it runs across midnight.
 */
export function freezeClock(): void {
  vi.useFakeTimers({ toFake: ["Date"] });

  onTestFinished(() => {
    vi.useRealTimers();
  });
}
