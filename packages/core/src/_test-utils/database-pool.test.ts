import { describe, expect, it } from "vitest";
import { createDatabasePool } from "../../../db/src/pool";

const ACQUISITION_DEADLINE_MS = 12_000;

describe(createDatabasePool, () => {
  it("rejects a starved real pool within a deadline and recovers after a release", async () => {
    const pool = createDatabasePool(process.env.DATABASE_URL);

    const connections = await Promise.allSettled(
      Array.from({ length: pool.options.max }, () => pool.connect()),
    );

    const held = connections.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );

    try {
      expect(held).toHaveLength(pool.options.max);

      const acquisition = pool.connect().then(
        (client) => {
          client.release();
          return { acquired: true };
        },
        (error: unknown) => ({ error }),
      );

      const { promise: deadline, resolve: deadlineReached } = Promise.withResolvers<string>();

      const watchdog = setTimeout(
        () => deadlineReached("acquisition kept waiting"),
        ACQUISITION_DEADLINE_MS,
      );

      try {
        expect(pool.waitingCount).toBe(1);
        const outcome = await Promise.race([acquisition, deadline]);

        expect(outcome).toMatchObject({
          error: expect.objectContaining({ message: "timeout exceeded when trying to connect" }),
        });

        expect(pool.waitingCount).toBe(0);
        held.pop()?.release();
        const result = await pool.query<{ ok: number }>("SELECT 1::int AS ok");
        expect(result.rows).toStrictEqual([{ ok: 1 }]);
        expect(pool.waitingCount).toBe(0);
      } finally {
        clearTimeout(watchdog);
      }
    } finally {
      held.forEach((client) => client.release());
      await pool.end();
    }
  });
});
