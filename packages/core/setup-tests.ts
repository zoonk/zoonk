import { beforeEach, vi } from "vitest";

vi.mock("next/cache");
vi.mock("next/headers");
vi.mock("server-only");
vi.mock("@zoonk/ai/course-suggestions/generate", { spy: true });

beforeEach(() => {
  vi.clearAllMocks();
});
