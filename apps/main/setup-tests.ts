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
vi.mock("@zoonk/ai/tasks/courses/learn-classification", { spy: true });
vi.mock("@zoonk/ai/tasks/courses/request-routing", { spy: true });

beforeEach(() => {
  vi.clearAllMocks();
});
