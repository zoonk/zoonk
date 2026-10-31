import { createRequire } from "node:module";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getBeltLevel } from "./get-belt-level";

type QueueClient = { query: (text: string) => Promise<unknown>; release: () => void };

type QueuePool = {
  connect: () => Promise<QueueClient>;
  end: () => Promise<void>;
  query: (text: string, values?: readonly unknown[]) => Promise<unknown>;
  waitingCount: number;
};

function createQueuePool(): QueuePool {
  const requireDatabaseDependency = createRequire(import.meta.resolve("@zoonk/db"));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Use the same installed driver as the DB adapter, not a second dependency or a mock.
  const { Pool } = requireDatabaseDependency("pg") as {
    Pool: new (options: { connectionString: string | undefined; max: number }) => QueuePool;
  };

  return new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
}

describe(countDatabaseStatements, () => {
  it("counts each INSERT, UPDATE, DELETE and MERGE once", async () => {
    const user = await userFixture();

    const counts = await countDatabaseStatements(() =>
      prisma.$transaction(async (tx) => {
        await tx.userProgress.create({ data: { userId: user.id } });

        await tx.userProgress.update({
          data: { totalBrainPower: 10n },
          where: { userId: user.id },
        });

        await tx.$executeRaw`MERGE INTO users USING (SELECT ${user.id}::uuid AS id) AS source
        ON users.id = source.id WHEN MATCHED THEN UPDATE SET name = 'Merged'`;

        await tx.userProgress.delete({ where: { userId: user.id } });
      }),
    );

    expect(counts).toMatchObject({ statements: 6, writes: 4 });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.name).toBe("Merged");

    await expect(
      prisma.userProgress.findUnique({ where: { userId: user.id } }),
    ).resolves.toBeNull();
  });

  it("counts the final command following a CTE while ignoring a read's merge alias", async () => {
    const user = await userFixture();

    const write = await countDatabaseStatements(
      () =>
        prisma.$executeRaw`WITH actor AS (SELECT ${user.id}::uuid AS id)
        UPDATE users SET name = 'CTE command' WHERE id IN (SELECT id FROM actor)`,
    );

    expect(write).toMatchObject({ statements: 1, writes: 1 });

    const read = await countDatabaseStatements(
      () => prisma.$queryRaw`WITH merge AS (SELECT 1 AS value) SELECT value AS merge FROM merge`,
    );

    assertReadBudget(read, 1);
    expect(read.statements).toBe(1);
  });

  it("counts SELECT row locks as reads, including FOR NO KEY UPDATE", async () => {
    const user = await userFixture();

    const counts = await countDatabaseStatements(() =>
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR NO KEY UPDATE`;
      }),
    );

    expect(counts.statements).toBe(4);
    assertReadBudget(counts, 4);
  });

  it("counts the existing belt capability's real read", async () => {
    const user = await userFixture();
    mockSession(user.id);
    await prisma.userProgress.create({ data: { totalBrainPower: 15_000n, userId: user.id } });

    const counts = await countDatabaseStatements(() => getBeltLevel());

    expect(counts.result?.level).toBe(8);
    expect(counts.statements).toBe(1);
    assertReadBudget(counts, 1);
    expect(() => assertReadBudget(counts, 0)).toThrow("at most 0 statements");
  });

  it("counts transaction writes and prevents them from passing a read budget", async () => {
    const user = await userFixture();

    const counts = await countDatabaseStatements(() =>
      prisma.$transaction(async (tx) => {
        await tx.user.update({ data: { name: "Changed" }, where: { id: user.id } });
      }),
    );

    expect(counts.statements).toBeGreaterThanOrEqual(3);
    expect(counts.writes).toBe(1);
    const changed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(changed.name).toBe("Changed");
    expect(() => assertReadBudget(counts, 10)).toThrow("Expected 0 writes");
  });

  it("counts a mutating CTE and ignores SQL words in literals and comments", async () => {
    const user = await userFixture();

    const counts = await countDatabaseStatements(
      () =>
        prisma.$queryRaw`WITH changed AS (UPDATE users SET name = 'UPDATE; DELETE' WHERE id = ${user.id}::uuid RETURNING id) SELECT id FROM changed /* INSERT */`,
    );

    expect(counts).toMatchObject({ statements: 1, writes: 1 });

    const read = await countDatabaseStatements(
      () =>
        prisma.$queryRaw`SELECT 'INSERT; UPDATE' AS text, $$DELETE; MERGE$$ AS literal /* UPDATE */`,
    );

    assertReadBudget(read, 1);
    expect(read.statements).toBe(1);
  });

  it("counts a write even when its transaction rolls back", async () => {
    const user = await userFixture();

    const counts = await countDatabaseStatements(async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.user.update({ data: { name: "Rolled back" }, where: { id: user.id } });
          throw new Error("Abort counted write");
        }),
      ).rejects.toThrow("Abort counted write");
    });

    expect(counts).toMatchObject({ statements: 3, writes: 1 });
    expect(() => assertReadBudget(counts, 3)).toThrow("Expected 0 writes");
    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(unchanged.name).toBe(user.name);
  });

  it("isolates concurrent callbacks while nested counts contribute to their parent", async () => {
    const user = await userFixture();

    const [read, write] = await Promise.all([
      countDatabaseStatements(() =>
        countDatabaseStatements(() => prisma.user.findUnique({ where: { id: user.id } })),
      ),
      countDatabaseStatements(() =>
        prisma.user.update({ data: { name: "Concurrent" }, where: { id: user.id } }),
      ),
    ]);

    expect(read).toMatchObject({ statements: 1, writes: 0 });
    expect(read.result).toMatchObject({ statements: 1, writes: 0 });
    expect(write).toMatchObject({ statements: 1, writes: 1 });
  });

  it("counts real queries queued behind a connection held outside the counter", async () => {
    const user = await userFixture();
    const pool = createQueuePool();

    try {
      const held = await pool.connect();
      const read = countDatabaseStatements(() => pool.query("SELECT 1"));

      const write = countDatabaseStatements(() =>
        pool.query("UPDATE users SET name = 'Queued write' WHERE id = $1::uuid", [user.id]),
      );

      const queued = pool.waitingCount;
      held.release();
      const [readCounts, writeCounts] = await Promise.all([read, write]);

      expect(queued).toBe(2);
      expect(readCounts).toMatchObject({ statements: 1, writes: 0 });
      expect(writeCounts).toMatchObject({ statements: 1, writes: 1 });
      expect(() => assertReadBudget(writeCounts, 1)).toThrow("Expected 0 writes");
      const changed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(changed.name).toBe("Queued write");
    } finally {
      await pool.end();
    }
  });

  it.each([
    { counted: true, submitter: "another counter" },
    { counted: false, submitter: "outside every counter" },
  ])("keeps a read isolated when a queued write comes from $submitter", async ({ counted }) => {
    const user = await userFixture();
    const pool = createQueuePool();
    const ready = Promise.withResolvers<null>();
    const release = Promise.withResolvers<null>();

    const read = countDatabaseStatements(async () => {
      const client = await pool.connect();

      try {
        await client.query("SELECT 1");
        ready.resolve(null);
        await release.promise;
      } finally {
        client.release();
      }
    });

    try {
      await Promise.race([ready.promise, read]);

      const submitWrite = () =>
        pool.query("UPDATE users SET name = 'Other counter' WHERE id = $1::uuid", [user.id]);

      const write = counted ? countDatabaseStatements(submitWrite) : submitWrite();

      const queued = pool.waitingCount;
      release.resolve(null);
      const [readCounts, writeCounts] = await Promise.all([read, write]);

      expect(queued).toBe(1);
      assertReadBudget(readCounts, 1);
      expect(readCounts.statements).toBe(1);

      expect(writeCounts).toMatchObject(
        counted ? { statements: 1, writes: 1 } : { command: "UPDATE", rowCount: 1 },
      );

      const changed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(changed.name).toBe("Other counter");
    } finally {
      release.resolve(null);
      await read;
      await pool.end();
    }
  });
});
