import { beforeEach, vi } from "vitest";
import { resetWorkflowMockState } from "./mocks/workflow";

vi.mock("server-only");

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetWorkflowMockState();
});
