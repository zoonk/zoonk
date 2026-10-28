import { vi } from "vitest";

export { RetryableError } from "./workflow-retryable-error";

type WorkflowMetadata = { workflowRunId: string };
type HookConflict = { returnValue: Promise<unknown>; runId: string };

const defaultWorkflowMetadata: WorkflowMetadata = { workflowRunId: "test-run-id" };

let workflowMetadata = { ...defaultWorkflowMetadata };
let hookConflict: HookConflict | null = null;
let hookConflictTokens: RegExp | null = null;

export const workflowReleaseLockMock = vi.fn();
export const workflowWriteMock = vi.fn().mockResolvedValue(null);

function createWritable() {
  return { getWriter: () => ({ releaseLock: workflowReleaseLockMock, write: workflowWriteMock }) };
}

export class FatalError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "FatalError";
  }
}

export const getWorkflowMetadata = vi.fn(() => workflowMetadata);
export const getWritable = vi.fn().mockReturnValue(createWritable());
export const sleep = vi.fn((_duration: Date | string) => Promise.resolve());

export const createHook = vi.fn((options?: { token?: string }) => ({
  [Symbol.dispose]: vi.fn(),
  dispose: vi.fn(),
  getConflict: () =>
    Promise.resolve(
      !hookConflictTokens || hookConflictTokens.test(options?.token ?? "") ? hookConflict : null,
    ),
  token: options?.token ?? "generated-token",
}));

export function resetWorkflowMockState(): void {
  workflowMetadata = { ...defaultWorkflowMetadata };

  workflowReleaseLockMock.mockReset();
  workflowWriteMock.mockReset().mockResolvedValue(null);
  getWorkflowMetadata.mockReset().mockImplementation(() => workflowMetadata);
  getWritable.mockReset().mockReturnValue(createWritable());
  // `mockReset` restores the implementation `vi.fn` was created with.
  sleep.mockReset();
  createHook.mockReset();
  hookConflict = null;
  hookConflictTokens = null;
}

export function mockHookConflict(
  conflict: HookConflict | null,
  { tokens = null }: { tokens?: RegExp | null } = {},
): void {
  hookConflict = conflict;
  hookConflictTokens = tokens;
}
