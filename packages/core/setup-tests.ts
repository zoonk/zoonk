import { beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  // Outside a request, Next.js' `io()` resolves at once, as it does here.
  io: async () => null,
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

// Tests run outside a request, where Next.js' `after` throws and `connection` has no request to wait
// for. Tests that check deferred work run it with `runDeferredWork` from
// `src/_test-utils/deferred-work.ts`.
vi.mock("next/server", () => ({ after: vi.fn(), connection: vi.fn(async () => null) }));

beforeEach(() => {
  vi.clearAllMocks();
});
