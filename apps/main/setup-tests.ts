import { AsyncLocalStorage } from "node:async_hooks";
import { beforeEach, vi } from "vitest";

globalThis.AsyncLocalStorage ??= AsyncLocalStorage;

vi.mock("server-only");
vi.mock("@zoonk/ai/tasks/courses/suggestions", { spy: true });

beforeEach(() => {
  vi.clearAllMocks();
});
