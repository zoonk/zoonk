import { beforeEach, vi } from "vitest";

vi.mock("server-only");

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock("@zoonk/ai/course-suggestions", () => ({
  generateCourseSuggestions: vi.fn(),
}));

vi.mock("@zoonk/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      sendVerificationOTP: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});
