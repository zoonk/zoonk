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
export const resumeHook = vi.fn((token: string, _payload: unknown): Promise<{ runId: string }> =>
  Promise.reject(new HookNotFoundError(token)),
);

export function resetWorkflowApiMock(): void {
  [getHookByToken, getRun, registerLifecycleHooks, resumeHook, start].forEach((mock) => {
    mock.mockReset();
  });
}
