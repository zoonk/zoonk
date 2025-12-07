import { beforeEach, vi } from "vitest";

vi.mock("next/cache");
vi.mock("next/headers");
vi.mock("server-only");
vi.mock("@zoonk/ai/course-suggestions", { spy: true });

beforeEach(() => {
  vi.clearAllMocks();
});
