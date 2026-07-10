// oxlint-disable jest/prefer-ending-with-an-expect

import { AsyncLocalStorage } from "node:async_hooks";
import { beforeEach, vi } from "vitest";

globalThis.AsyncLocalStorage ??= AsyncLocalStorage;

vi.mock("server-only");

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/canonical-title", { spy: true });
vi.mock("@zoonk/ai/tasks/courses/format", { spy: true });
vi.mock("@zoonk/ai/tasks/courses/intent", { spy: true });
vi.mock("@zoonk/ai/tasks/courses/personalization", { spy: true });

beforeEach(() => {
  vi.clearAllMocks();
});
