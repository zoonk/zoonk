import { prisma } from "@zoonk/db";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { purgeMemoryFacts } from "./purge-memory-facts";

const DAY_MS = 86_400_000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

describe(purgeMemoryFacts, () => {
  it("purges facts deleted or expired more than 30 days ago with the facts they replaced", async () => {
    const user = await userFixture();

    const [oldDeleted, oldExpired, recentDeleted, recentExpired, active] = await Promise.all([
      memoryFactFixture({ deletedAt: daysAgo(31), status: "deleted", userId: user.id }),
      memoryFactFixture({ expiresAt: daysAgo(31), statement: "Has an exam", userId: user.id }),
      memoryFactFixture({ deletedAt: daysAgo(29), status: "deleted", userId: user.id }),
      memoryFactFixture({ expiresAt: daysAgo(2), userId: user.id }),
      memoryFactFixture({ userId: user.id }),
    ]);

    const replacedByExpired = await memoryFactFixture({
      status: "superseded",
      supersededById: oldExpired.id,
      userId: user.id,
    });

    const replacedByActive = await memoryFactFixture({
      status: "superseded",
      supersededById: active.id,
      userId: user.id,
    });

    const { purged } = await purgeMemoryFacts();

    expect(purged).toBeGreaterThanOrEqual(3);

    const remaining = await prisma.memoryFact.findMany({
      select: { id: true },
      where: { userId: user.id },
    });

    expect(remaining.map((fact) => fact.id).toSorted()).toStrictEqual(
      [recentDeleted.id, recentExpired.id, active.id, replacedByActive.id].toSorted(),
    );

    expect(remaining.map((fact) => fact.id)).not.toContain(oldDeleted.id);
    expect(remaining.map((fact) => fact.id)).not.toContain(replacedByExpired.id);
  });
});
