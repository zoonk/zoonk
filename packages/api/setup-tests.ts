import { beforeEach, vi } from "vitest";

vi.mock("server-only");
vi.mock("next/cache");
vi.mock("@zoonk/ai/course-suggestions");

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
