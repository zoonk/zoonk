import { beforeEach, vi } from "vitest";

vi.mock("server-only");

beforeEach(() => {
  vi.clearAllMocks();
});
