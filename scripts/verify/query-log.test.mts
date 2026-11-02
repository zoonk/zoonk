import { afterEach, describe, expect, it, vi } from "vitest";
import { createDatabasePool } from "../../packages/db/src/pool";

vi.mock("node:fs", () => ({ createWriteStream: () => ({ write: vi.fn() }) }));

describe("query logging during Next prerendering", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("times queries without reading the render clock", async () => {
    vi.stubEnv("ZOONK_QUERY_LOG", "/unused/query-log.jsonl");
    const pool = createDatabasePool("postgresql://localhost/unused");
    const client = { query: async (_sql: string) => ({ rowCount: 0 }) };
    pool.emit("connect", client);

    const clock = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Unstable render clock");
    });

    try {
      expect(() => client.query("SELECT 1")).not.toThrow();
      expect(clock).toHaveBeenCalledTimes(0);
    } finally {
      clock.mockRestore();
      await pool.end();
    }
  });
});
