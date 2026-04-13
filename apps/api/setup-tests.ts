import { beforeEach, vi } from "vitest";
import { resetWorkflowMockState } from "./mocks/workflow";

vi.mock("server-only");

beforeEach(() => {
  vi.clearAllMocks();
  resetWorkflowMockState();
});
