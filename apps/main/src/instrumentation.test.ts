import { describe, expect, it, vi } from "vitest";
import { register } from "./instrumentation";

vi.mock("@zoonk/db", () => {
  throw new Error("register() loaded the database client");
});

describe(register, () => {
  it("loads no database client, since it runs before the first request of every server, each region's proxy included", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    await expect(register()).resolves.toBeUndefined();
  });
});
