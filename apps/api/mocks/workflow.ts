import { vi } from "vitest";

type WorkflowMetadata = {
  workflowRunId: string;
};

const defaultWorkflowMetadata: WorkflowMetadata = {
  workflowRunId: "test-run-id",
};

let workflowMetadata = { ...defaultWorkflowMetadata };

export const workflowReleaseLockMock = vi.fn();
export const workflowWriteMock = vi.fn().mockResolvedValue(null);

/**
 * Builds the writable shape that our workflow helpers expect.
 * Tests do not need a real stream implementation here — they only need
 * a stable place to capture writes so stream assertions can inspect them.
 */
function createWritable() {
  return {
    getWriter: () => ({
      releaseLock: workflowReleaseLockMock,
      write: workflowWriteMock,
    }),
  };
}

export class FatalError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "FatalError";
  }
}

export const getWorkflowMetadata = vi.fn(() => workflowMetadata);
export const getWritable = vi.fn().mockReturnValue(createWritable());
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
}
