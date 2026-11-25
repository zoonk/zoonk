import { vi } from "vitest";
import { HookNotFoundError } from "workflow/errors";

export const start = vi.fn((..._args: unknown[]) =>
  Promise.resolve({ returnValue: Promise.resolve(null), runId: "started-run" }),
);
export const getRun = vi.fn((_runId: string): unknown => ({ exists: Promise.resolve(false) }));
export const getHookByToken = vi.fn((token: string): Promise<{ runId: string }> =>
  Promise.reject(new HookNotFoundError(token)),
);
export const registerLifecycleHooks = vi.fn();

export function resetWorkflowApiMock(): void {
  [getHookByToken, getRun, registerLifecycleHooks, start].forEach((mock) => {
    mock.mockReset();
  });
}
