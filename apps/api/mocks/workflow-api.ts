import { vi } from "vitest";

/**
 * Runs only exist inside the workflow runtime, so `start` only records what a workflow started
 * (tests that need a started run's work run it inline through this mock), and `getRun` finds no
 * run unless a test says how one stands.
 */
export const start = vi.fn((..._args: unknown[]) => Promise.resolve({ runId: "started-run" }));
export const getRun = vi.fn((_runId: string): unknown => ({ exists: Promise.resolve(false) }));
export const registerLifecycleHooks = vi.fn();

/** Each test starts with no run started and none to find, whatever the test before it said. */
export function resetWorkflowApiMock(): void {
  [getRun, registerLifecycleHooks, start].forEach((mock) => {
    mock.mockReset();
  });
}
