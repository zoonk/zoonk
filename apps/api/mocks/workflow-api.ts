import { vi } from "vitest";

export const start = vi.fn((..._args: unknown[]) => Promise.resolve({ runId: "started-run" }));
export const getRun = vi.fn((_runId: string): unknown => ({ exists: Promise.resolve(false) }));
export const registerLifecycleHooks = vi.fn();

export function resetWorkflowApiMock(): void {
  [getRun, registerLifecycleHooks, start].forEach((mock) => {
    mock.mockReset();
  });
}
