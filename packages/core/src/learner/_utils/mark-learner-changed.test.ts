import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { markLearnerChanged, markPlansChanged } from "./mark-learner-changed";

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
    expect(statements[1]).toMatch(LEARNER_LOCK);
    expect(statements.some((query) => query.includes("input_version"))).toBe(false);

    await expect(
      prisma.plan.findMany({ where: { id: { in: plans.map((row) => row.id) } } }),
    ).resolves.toMatchObject(plans.map(() => ({ inputVersion: 0, version: 1 })));
  });

  it("makes a second writer of the same learner wait for the first", async () => {
    const user = await userFixture();
    const held = holdLearnerLock({ userId: user.id });
    const pid = await held.pid;
    const second = prisma.$transaction((tx) => markLearnerChanged(tx, { userId: user.id }));

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
    } finally {
      held.release();
      await held.done;
    }

    await expect(second).resolves.toBeUndefined();
  });

  it("marks plan inputs with one plans update, its locks taken before the learner's", async () => {
    const user = await userFixture();
    const plans = await Promise.all([plan(user.id), plan(user.id)]);
    const { client, statements } = observeStatements();

    await client.$transaction((tx) =>
      markLearnerChanged(tx, { planInputs: true, userId: user.id }),
    );

    expect(statements.filter((query) => /^\s*UPDATE plans\b/iu.test(query))).toHaveLength(1);
    expect(statements.filter((query) => LEARNER_LOCK.test(query))).toHaveLength(1);
    const learnerLock = statements.findIndex((query) => LEARNER_LOCK.test(query));

    const locks = statements.flatMap((query, index) =>
      /FOR UPDATE OF plan/u.test(query) ? [index] : [],
    );

    expect(locks.length).toBeGreaterThan(0);
    expect(locks.every((index) => index < learnerLock)).toBe(true);
    const rows = await prisma.plan.findMany({ where: { id: { in: plans.map((row) => row.id) } } });
    expect(rows.every((row) => row.inputVersion === 1 && row.version === 1)).toBe(true);
  });

  it("marks the plan inputs of a learner with zero plans without inventing a target", async () => {
    const user = await userFixture();

    await prisma.$transaction((tx) =>
      markLearnerChanged(tx, { planInputs: true, userId: user.id }),
    );

    await expect(prisma.plan.count({ where: { goal: { userId: user.id } } })).resolves.toBe(0);
  });
});

describe(markPlansChanged, () => {
  it("locks dependent owners in one statement rather than one round trip per learner", async () => {
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

    expect(statements.filter((query) => /^\s*SELECT id FROM users\b/iu.test(query))).toHaveLength(
      1,
    );

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
      prisma.plan.findMany({
        orderBy: { id: "asc" },
        where: { id: { in: [firstPlan.id, secondPlan.id] } },
      }),
    ).resolves.toMatchObject(
      [
        { id: firstPlan.id, inputVersion: 2 },
        { id: secondPlan.id, inputVersion: 1 },
      ].toSorted((a, b) => a.id.localeCompare(b.id)),
    );
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

    await expect(prisma.plan.findMany({ where: { id: { in: planIds } } })).resolves.toMatchObject(
      planIds.map(() => ({ inputVersion: 3 })),
    );
  });

  it("deduplicates plans, includes guests' plans, and marks no other learner's", async () => {
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

    const rows = await prisma.plan.findMany({
      where: { id: { in: [one.id, two.id, three.id, other.id] } },
    });

    const versions = new Map(rows.map((row) => [row.id, row.inputVersion]));
    expect([one, two, three, other].map((row) => versions.get(row.id))).toStrictEqual([1, 1, 1, 0]);

    await prisma.$transaction((tx) => markPlansChanged(tx, { planIds: [] }));
    expect(other.id).not.toBe(one.id);
  });

  it("rolls every plan mark back together", async () => {
    const [first, second] = await Promise.all([userFixture(), userFixture()]);
    const plans = await Promise.all([plan(first.id), plan(second.id)]);

    await expect(
      prisma.$transaction(async (tx) => {
        await markPlansChanged(tx, { planIds: plans.map((item) => item.id) });
        throw new Error("Roll back shared write");
      }),
    ).rejects.toThrow("Roll back shared write");

    await expect(
      prisma.plan.findMany({ where: { id: { in: plans.map((row) => row.id) } } }),
    ).resolves.toMatchObject(plans.map(() => ({ inputVersion: 0 })));
  });
});
