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

/**
 * Builds the writable shape that our workflow helpers expect.
 * Tests do not need a real stream implementation here — they only need
 * a stable place to capture writes so stream assertions can inspect them.
 */
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
/** Durable sleeps resolve at once, so workflow tests run polling loops without waiting. */
export const sleep = vi.fn((_duration: Date | string) => Promise.resolve());

/**
 * Hooks only exist inside the workflow runtime, so a test decides whether another run holds a
 * token. Disposing one (`using`, or releasing a token early) does nothing here.
 */
export const createHook = vi.fn((options?: { token?: string }) => ({
  [Symbol.dispose]: vi.fn(),
  dispose: vi.fn(),
  getConflict: () =>
    Promise.resolve(
      !hookConflictTokens || hookConflictTokens.test(options?.token ?? "") ? hookConflict : null,
    ),
  token: options?.token ?? "generated-token",
}));
export const workflowStep = vi.fn((_name: string, fn: unknown) => fn);

/**
 * Restores the shared workflow mock to the default state before each test.
 * This exists because many workflow tests only clear call history globally,
 * but they also rely on the default run id and stream writer being recreated
 * consistently after a test changes the mock behavior.
 */
export function resetWorkflowMockState(): void {
  workflowMetadata = { ...defaultWorkflowMetadata };

  workflowReleaseLockMock.mockReset();
  workflowWriteMock.mockReset().mockResolvedValue(null);
  getWorkflowMetadata.mockReset().mockImplementation(() => workflowMetadata);
  getWritable.mockReset().mockReturnValue(createWritable());
  workflowStep.mockReset().mockImplementation((_name: string, fn: unknown) => fn);
  // Resetting keeps the implementations `vi.fn` was created with.
  sleep.mockReset();
  createHook.mockReset();
  hookConflict = null;
  hookConflictTokens = null;
}

/**
 * Another run holds every hook's token, like a second learner's research for the same exam, or
 * only the tokens `tokens` matches when a workflow takes several hooks.
 */
export function mockHookConflict(
  conflict: HookConflict | null,
  { tokens = null }: { tokens?: RegExp | null } = {},
): void {
  hookConflict = conflict;
  hookConflictTokens = tokens;
}
