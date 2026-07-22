// oxlint-disable jest/prefer-ending-with-an-expect

import { AsyncLocalStorage } from "node:async_hooks";
import { type cookies, type draftMode, headers } from "next/headers";
import { beforeEach, vi } from "vitest";

type NextHeadersModule = {
  cookies: typeof cookies;
  draftMode: typeof draftMode;
  headers: typeof headers;
};

globalThis.AsyncLocalStorage ??= AsyncLocalStorage;

vi.mock("server-only");

vi.mock("next/headers", async (importOriginal) => {
  const original = await importOriginal<NextHeadersModule>();

  return { ...original, headers: vi.fn() };
});

vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/canonical-title", { spy: true });
vi.mock("@zoonk/ai/tasks/courses/format", { spy: true });
vi.mock("@zoonk/ai/tasks/courses/intent", { spy: true });
vi.mock("@zoonk/ai/tasks/courses/personalization", { spy: true });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(headers).mockResolvedValue(new Headers());
});
