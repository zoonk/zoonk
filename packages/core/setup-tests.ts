import { beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

// Tests run outside a request, where Next.js' `after` throws. Tests that check deferred work run it
// with `runDeferredWork` from `src/_test-utils/deferred-work.ts`.
vi.mock("next/server", () => ({ after: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});
