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
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  // Outside a request, Next.js' `io()` resolves at once, as it does here.
  io: async () => null,
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn(),
  updateTag: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(headers).mockResolvedValue(new Headers());
});
