import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { markLearnerChanged, markPlansChanged } from "./mark-learner-changed";

async function revision(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return user.learnerRevision;
}

async function plan(userId: string) {
  const goal = await goalFixture({ userId });
  return planFixture({ goalId: goal.id });
}

function queryText(args: unknown): string {
  if (typeof args === "object" && args !== null && "sql" in args && typeof args.sql === "string") {
    return args.sql;
  }

  if (Array.isArray(args)) {
    return args.every((part) => typeof part === "string") ? args.join("") : queryText(args[0]);
  }

  throw new Error("Expected a raw SQL query at the Prisma observation boundary");
}

/** Observe real SQL through Prisma's query lifecycle, without changing its args or results. */
function observeStatements() {
  const statements: string[] = [];

  const client = prisma.$extends({
    query: {
      $executeRaw({ args, query }) {
        statements.push(queryText(args));
        return query(args);
      },
      $queryRaw({ args, query }) {
        statements.push(queryText(args));
        return query(args);
      },
    },
  });

  return { client, statements };
}

describe(markLearnerChanged, () => {
  it("increments monotonically once per call, including plan-input changes", async () => {
    const user = await userFixture();
    await expect(revision(user.id)).resolves.toBe(0n);

    const results = await prisma.$transaction(async (tx) => [
      await markLearnerChanged(tx, { userId: user.id }),
      await markLearnerChanged(tx, { planInputs: true, userId: user.id }),
    ]);

    expect(results).toStrictEqual([{ learnerRevision: 1n }, { learnerRevision: 2n }]);
    await expect(revision(user.id)).resolves.toBe(2n);
  });

  it("invalidates only the learner's owned plans and leaves plan edit versions alone", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const plans = await Promise.all([plan(owner.id), plan(owner.id), plan(other.id)]);

    await prisma.$transaction((tx) => markLearnerChanged(tx, { userId: owner.id }));

    await expect(
      prisma.plan.findMany({
        orderBy: { id: "asc" },
        where: { id: { in: plans.map((row) => row.id) } },
      }),
    ).resolves.toMatchObject(
      plans
        .toSorted((a, b) => a.id.localeCompare(b.id))
        .map(() => ({ inputVersion: 0, version: 1 })),
    );

    await prisma.$transaction((tx) =>
      markLearnerChanged(tx, { planInputs: true, userId: owner.id }),
    );

    const rows = await prisma.plan.findMany({ where: { id: { in: plans.map((row) => row.id) } } });
    const versions = new Map(rows.map((row) => [row.id, row.inputVersion]));

    expect(plans.map((row) => versions.get(row.id))).toStrictEqual([1, 1, 0]);
    expect(rows.every((row) => row.version === 1)).toBe(true);
    await expect(revision(other.id)).resolves.toBe(0n);
  });

  it("locks requested owned plans before the learner without invalidating planning inputs", async () => {
    const user = await userFixture();
    const plans = await Promise.all([plan(user.id), plan(user.id)]);
    const { client, statements } = observeStatements();

    await client.$transaction((tx) =>
      markLearnerChanged(tx, {
        lockPlanIds: [plans[1]!.id, plans[0]!.id, plans[1]!.id],
        userId: user.id,
      }),
    );

    expect(statements[0]).toMatch(/SELECT plan\.id[\s\S]*ORDER BY plan\.id FOR UPDATE OF plan/u);
    expect(statements[1]).toMatch(/UPDATE users/u);
    expect(statements.some((query) => query.includes("input_version"))).toBe(false);
    await expect(revision(user.id)).resolves.toBe(1n);

    await expect(
      prisma.plan.findMany({ where: { id: { in: plans.map((row) => row.id) } } }),
    ).resolves.toMatchObject(plans.map(() => ({ inputVersion: 0, version: 1 })));
  });

  it("serializes concurrent transactions without losing increments", async () => {
    const user = await userFixture();

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        prisma.$transaction((tx) => markLearnerChanged(tx, { userId: user.id })),
      ),
    );

    expect(new Set(results.map((result) => result.learnerRevision))).toStrictEqual(
      new Set([1n, 2n, 3n, 4n]),
    );

    await expect(revision(user.id)).resolves.toBe(4n);
  });

  it("includes guest learners and rolls the revision back with the domain write", async () => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.update({ data: { name: "Rolled back" }, where: { id: user.id } });

        await expect(markLearnerChanged(tx, { userId: user.id })).resolves.toStrictEqual({
          learnerRevision: 1n,
        });

        throw new Error("Roll back domain write");
      }),
    ).rejects.toThrow("Roll back domain write");

    await expect(revision(user.id)).resolves.toBe(0n);
    const restoredUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(restoredUser.name).toBe(user.name);

    await expect(
      prisma.$transaction((tx) => markLearnerChanged(tx, { userId: user.id })),
    ).resolves.toStrictEqual({ learnerRevision: 1n });
  });

  it("marks plan inputs with one plans update, its locks taken before one user update", async () => {
    const user = await userFixture();
    const plans = await Promise.all([plan(user.id), plan(user.id)]);
    const { client, statements } = observeStatements();

    await client.$transaction((tx) =>
      markLearnerChanged(tx, { planInputs: true, userId: user.id }),
    );

    expect(statements.filter((query) => /^\s*UPDATE plans\b/iu.test(query))).toHaveLength(1);
    expect(statements.filter((query) => /^\s*UPDATE users\b/iu.test(query))).toHaveLength(1);
    const learnerWrite = statements.findIndex((query) => /^\s*UPDATE users\b/iu.test(query));

    const locks = statements.flatMap((query, index) =>
      /FOR UPDATE OF plan/u.test(query) ? [index] : [],
    );

    expect(locks.length).toBeGreaterThan(0);
    expect(locks.every((index) => index < learnerWrite)).toBe(true);
    await expect(revision(user.id)).resolves.toBe(1n);
    const rows = await prisma.plan.findMany({ where: { id: { in: plans.map((row) => row.id) } } });
    expect(rows.every((row) => row.inputVersion === 1 && row.version === 1)).toBe(true);
  });

  it("marks the plan inputs of a learner with zero plans without inventing a target", async () => {
    const user = await userFixture();

    await prisma.$transaction((tx) =>
      markLearnerChanged(tx, { planInputs: true, userId: user.id }),
    );

    await expect(prisma.plan.count({ where: { goal: { userId: user.id } } })).resolves.toBe(0);
    await expect(revision(user.id)).resolves.toBe(1n);
  });
});

describe(markPlansChanged, () => {
  it("updates dependent owners in one statement rather than one round trip per learner", async () => {
    const users = await Promise.all(Array.from({ length: 4 }, () => userFixture()));

    const plans = await Promise.all([
      plan(users[0]!.id),
      plan(users[0]!.id),
      plan(users[1]!.id),
      plan(users[2]!.id),
    ]);

    const { client, statements } = observeStatements();

    await client.$transaction((tx) =>
      markPlansChanged(tx, { planIds: [...plans.map((row) => row.id), plans[0]!.id].toReversed() }),
    );

    expect(statements.filter((query) => /^\s*UPDATE\s+users\b/iu.test(query))).toHaveLength(1);

    await expect(Promise.all(users.map((user) => revision(user.id)))).resolves.toStrictEqual([
      1n,
      1n,
      1n,
      0n,
    ]);

    await expect(
      prisma.plan.findMany({ where: { id: { in: plans.map((row) => row.id) } } }),
    ).resolves.toMatchObject(plans.map(() => ({ inputVersion: 1, version: 1 })));
  });

  it("locks plans before users across mixed concurrent writers", async () => {
    const [firstUser, secondUser] = await Promise.all([userFixture(), userFixture()]);
    const firstPlan = await plan(firstUser.id);
    const secondPlan = await plan(secondUser.id);
    const locked = Promise.withResolvers<null>();
    const continueFirst = Promise.withResolvers<null>();
    const secondPID = Promise.withResolvers<number>();

    const firstWriter = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM plans WHERE id = ${firstPlan.id}::uuid FOR UPDATE`;
      locked.resolve(null);
      await continueFirst.promise;
      return markLearnerChanged(tx, { planInputs: true, userId: firstUser.id });
    });

    await locked.promise;

    const secondWriter = prisma.$transaction(async (tx) => {
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid()::int AS pid`;

      if (!backend) {
        throw new Error("Expected transaction backend");
      }

      secondPID.resolve(backend.pid);
      await markPlansChanged(tx, { planIds: [secondPlan.id, firstPlan.id, firstPlan.id] });
      await tx.plan.update({ data: { version: { increment: 1 } }, where: { id: firstPlan.id } });
    });

    const pid = await secondPID.promise;

    try {
      await expect
        .poll(async () => {
          const [backend] = await prisma.$queryRaw<{ waiting: boolean }[]>`
          SELECT wait_event_type = 'Lock' AS waiting FROM pg_stat_activity WHERE pid = ${pid}
        `;

          return backend?.waiting;
        })
        .toBe(true);
    } finally {
      continueFirst.resolve(null);
    }

    await Promise.all([firstWriter, secondWriter]);

    await expect(
      Promise.all([revision(firstUser.id), revision(secondUser.id)]),
    ).resolves.toStrictEqual([2n, 1n]);
  });

  it("serializes overlapping plans in opposite input orders and mixed helper calls", async () => {
    const [first, second] = await Promise.all([userFixture(), userFixture()]);
    const [one, two, three] = await Promise.all([plan(first.id), plan(first.id), plan(second.id)]);
    const planIds = [one.id, two.id, three.id];

    await Promise.all([
      prisma.$transaction((tx) => markPlansChanged(tx, { planIds })),
      prisma.$transaction((tx) => markPlansChanged(tx, { planIds: planIds.toReversed() })),
      prisma.$transaction((tx) => markLearnerChanged(tx, { planInputs: true, userId: first.id })),
      prisma.$transaction((tx) => markLearnerChanged(tx, { planInputs: true, userId: second.id })),
    ]);

    await expect(Promise.all([revision(first.id), revision(second.id)])).resolves.toStrictEqual([
      3n,
      3n,
    ]);

    await expect(prisma.plan.findMany({ where: { id: { in: planIds } } })).resolves.toMatchObject(
      planIds.map(() => ({ inputVersion: 3 })),
    );
  });

  it("deduplicates plan owners, includes guests, and returns no revisions", async () => {
    const [first, guest, unaffected] = await Promise.all([
      userFixture(),
      userFixture(),
      userFixture(),
    ]);

    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });

    const [one, two, three, other] = await Promise.all([
      plan(first.id),
      plan(first.id),
      plan(guest.id),
      plan(unaffected.id),
    ]);

    await expect(
      prisma.$transaction((tx) =>
        markPlansChanged(tx, { planIds: [one.id, one.id, two.id, three.id] }),
      ),
    ).resolves.toBeUndefined();

    await expect(
      Promise.all([revision(first.id), revision(guest.id), revision(unaffected.id)]),
    ).resolves.toStrictEqual([1n, 1n, 0n]);

    const rows = await prisma.plan.findMany({
      where: { id: { in: [one.id, two.id, three.id, other.id] } },
    });

    const versions = new Map(rows.map((row) => [row.id, row.inputVersion]));
    expect([one, two, three, other].map((row) => versions.get(row.id))).toStrictEqual([1, 1, 1, 0]);

    await prisma.$transaction((tx) => markPlansChanged(tx, { planIds: [] }));
    await expect(revision(first.id)).resolves.toBe(1n);
    expect(other.id).not.toBe(one.id);
  });

  it("rolls every owner increment back together", async () => {
    const [first, second] = await Promise.all([userFixture(), userFixture()]);
    const plans = await Promise.all([plan(first.id), plan(second.id)]);

    await expect(
      prisma.$transaction(async (tx) => {
        await markPlansChanged(tx, { planIds: plans.map((item) => item.id) });
        throw new Error("Roll back shared write");
      }),
    ).rejects.toThrow("Roll back shared write");

    await expect(Promise.all([revision(first.id), revision(second.id)])).resolves.toStrictEqual([
      0n,
      0n,
    ]);

    await expect(
      prisma.plan.findMany({ where: { id: { in: plans.map((row) => row.id) } } }),
    ).resolves.toMatchObject(plans.map(() => ({ inputVersion: 0 })));
  });
});
