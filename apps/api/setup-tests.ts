import { beforeEach, vi } from "vitest";
import { resetWorkflowMockState } from "./mocks/workflow";
import { resetWorkflowRuntimeMock } from "./mocks/workflow-runtime";

vi.mock("server-only");

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  // Outside a request, Next.js' `io()` resolves at once, as it does here.
  io: async () => null,
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetWorkflowMockState();
  resetWorkflowRuntimeMock();
});
