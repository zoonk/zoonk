import { beforeEach, vi } from "vitest";

vi.mock("server-only");
vi.mock("next/cache");
vi.mock("@zoonk/ai/course-suggestions");

beforeEach(() => {
  vi.clearAllMocks();
});
