import { afterAll, beforeAll, beforeEach, vi } from "vitest";
import { boundaries, resetBoundaries } from "./mocks/boundaries";
import { resetWorkflowMockState } from "./mocks/workflow";
import { resetWorkflowApiMock } from "./mocks/workflow-api";
import { resetWorkflowRuntimeMock } from "./mocks/workflow-runtime";

vi.mock("server-only");

vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  // Outside a request, Next.js' `io()` resolves at once, as it does here.
  io: async () => null,
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

// The edges every test replaces, declared once (see `mocks/boundaries.ts`).
Object.entries(boundaries).forEach(([path, mocks]) => {
  vi.doMock(path, async (importOriginal) => ({ ...(await importOriginal<object>()), ...mocks }));
});

// Test files share workers: each starts as a fresh one would, and leaves no fake clock, stubbed
// global or spy behind for the next.
beforeAll(() => {
  resetBoundaries();
});

beforeEach(() => {
  vi.clearAllMocks();
  resetWorkflowMockState();
  resetWorkflowApiMock();
  resetWorkflowRuntimeMock();
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
