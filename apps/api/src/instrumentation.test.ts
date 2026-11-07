import { describe, expect, it, vi } from "vitest";

const loads = vi.hoisted(() => ({ database: 0, fileSystem: 0 }));

/** Counted as well as thrown, so code that catches the error still fails the test. */
vi.mock("@zoonk/db", () => {
  loads.database += 1;
  throw new Error("register() loaded the database client");
});

describe("register", () => {
  it("loads no database client in production, since it runs before the first request of every server, each region's proxy included", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "production");

    const { register } = await import("./instrumentation");
    await register();

    expect(loads.database).toBe(0);
  });

  it("loads no Node file system module on the edge, since Next builds it for the edge runtime too", async () => {
    vi.resetModules();

    vi.doMock("node:fs/promises", () => {
      loads.fileSystem += 1;
      throw new Error("register() loaded node:fs/promises on the edge");
    });

    vi.stubEnv("NEXT_RUNTIME", "edge");

    const { register } = await import("./instrumentation");
    await register();

    expect(loads.fileSystem).toBe(0);
  });
});
