import { AsyncLocalStorage } from "node:async_hooks";
import { beforeEach, vi } from "vitest";

globalThis.AsyncLocalStorage ??= AsyncLocalStorage;

vi.mock("server-only");

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/suggestions", { spy: true });

beforeEach(() => {
  vi.clearAllMocks();
});
