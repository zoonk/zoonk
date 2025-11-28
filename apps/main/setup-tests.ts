import { AsyncLocalStorage } from "node:async_hooks";
import { vi } from "vitest";

globalThis.AsyncLocalStorage ??= AsyncLocalStorage;

vi.mock("server-only");
