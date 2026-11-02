import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { holdTransaction, waitForBlocked } from "./_test-utils/blocked-sessions";
import { createGoal, createLearner } from "./_test-utils/learner-data";
import { linkGuestAccount } from "./link-guest-account";

async function readMarks({ goalIds }: { goalIds: string[] }) {
  const plans = await prisma.plan.findMany({
    orderBy: { goalId: "asc" },
    select: { goalId: true, inputVersion: true },
    where: { goalId: { in: goalIds } },
  });

  return { plans };
}

async function createLearnersWithPlans() {
  const [accountId, guestId] = await Promise.all([
    createLearner({ isAnonymous: false }),
    createLearner({ isAnonymous: true }),
  ]);

  const goals = await Promise.all([createGoal(accountId), createGoal(guestId)]);
  await Promise.all(goals.map((goal) => prisma.plan.create({ data: { goalId: goal.id } })));

  return { accountId, goalIds: goals.map((goal) => goal.id), guestId };
}

describe(linkGuestAccount, () => {
  it("marks the account's and the guest's plans changed", async () => {
    const { accountId, goalIds, guestId } = await createLearnersWithPlans();
    const before = await readMarks({ goalIds });

    await linkGuestAccount({ account: { id: accountId }, guestUserId: guestId });

    await expect(readMarks({ goalIds })).resolves.toStrictEqual({
      plans: before.plans.map((plan) => ({ ...plan, inputVersion: plan.inputVersion + 1 })),
    });
  });

  it("moves a guest's private course, its skills and pictures included, so deleting the guest keeps them", async () => {
    const [accountId, guestId] = await Promise.all([
      createLearner({ isAnonymous: false }),
      createLearner({ isAnonymous: true }),
    ]);

    const id = randomUUID();
    const privateRow = { ownerId: guestId, visibility: "private" as const };
    const provenance = { model: "test-model", promptVersion: "test", runId: `test-run-${id}` };

    const [skill, picture] = await Promise.all([
      prisma.skill.create({
        data: {
          ...privateRow,
          ...provenance,
          description: "A private idea in one sentence",
          identityKey: `private:${guestId}:skill:${id}`,
          language: "en",
          name: `Private skill ${id}`,
          normalizedName: `private skill ${id}`,
        },
      }),
      prisma.mediaAsset.create({
        data: {
          ...privateRow,
          ...provenance,
          kind: "image",
          reuseKey: `private:${guestId}:image:${id}`,
          url: `https://store.private.blob.vercel-storage.com/images/${guestId}/step-${id}.webp`,
        },
      }),
    ]);

    await linkGuestAccount({ account: { id: accountId }, guestUserId: guestId });

    await expect(prisma.user.findUnique({ where: { id: guestId } })).resolves.toBeNull();

    await expect(
      prisma.skill.findUnique({ select: { ownerId: true }, where: { id: skill.id } }),
    ).resolves.toStrictEqual({ ownerId: accountId });

    await expect(
      prisma.mediaAsset.findUnique({ select: { ownerId: true }, where: { id: picture.id } }),
    ).resolves.toStrictEqual({ ownerId: accountId });
  });

  it("changes nothing when another sign-in already moved the guest", async () => {
    const { accountId, goalIds, guestId } = await createLearnersWithPlans();
    const link = { account: { id: accountId }, guestUserId: guestId };
    await linkGuestAccount(link);
    const linked = await readMarks({ goalIds });

    await linkGuestAccount(link);

    await expect(readMarks({ goalIds })).resolves.toStrictEqual(linked);
  });

  it("marks the account before it takes any lock of its own rows", async () => {
    const { accountId, guestId } = await createLearnersWithPlans();

    const writing = await holdTransaction(
      (transaction) =>
        transaction.$queryRaw`SELECT id FROM users WHERE id = ${accountId}::uuid FOR UPDATE`,
    );

    const linking = linkGuestAccount({ account: { id: accountId }, guestUserId: guestId });

    try {
      await waitForBlocked({ blocker: writing.blocker, count: 1 });

      const [advisory, guestRows] = await Promise.all([
        prisma.$queryRaw<{ pid: number }[]>`
          SELECT lock.pid FROM pg_locks AS lock
          WHERE lock.locktype = 'advisory' AND ${writing.blocker}::int = ANY(pg_blocking_pids(lock.pid))
        `,
        prisma.$transaction(
          (transaction) => transaction.$queryRaw<{ id: string }[]>`
            SELECT id FROM users WHERE id = ${guestId}::uuid FOR UPDATE SKIP LOCKED
          `,
        ),
      ]);

      expect({ advisory, guestRows: guestRows.length }).toStrictEqual({
        advisory: [],
        guestRows: 1,
      });
    } finally {
      writing.release();
    }

    await writing.held;
    await linking;
    await expect(prisma.user.findUnique({ where: { id: guestId } })).resolves.toBeNull();
  });

  it("marks a plan another link moved into the account while this one waited", async () => {
    const [accountId, ...guestIds] = await Promise.all([
      createLearner({ isAnonymous: false }),
      createLearner({ isAnonymous: true }),
      createLearner({ isAnonymous: true }),
    ]);

    const goals = await Promise.all(guestIds.map((guestId) => createGoal(guestId)));
    const goalIds = goals.map((goal) => goal.id);
    await Promise.all(goalIds.map((goalId) => prisma.plan.create({ data: { goalId } })));
    const before = await readMarks({ goalIds });

    const writing = await holdTransaction(
      (transaction) =>
        transaction.$queryRaw`SELECT id FROM users WHERE id = ${accountId}::uuid FOR UPDATE`,
    );

    const linking = Promise.all(
      guestIds.map((guestUserId) => linkGuestAccount({ account: { id: accountId }, guestUserId })),
    );

    try {
      await waitForBlocked({ blocker: writing.blocker, count: 2 });
    } finally {
      writing.release();
    }

    await writing.held;
    await linking;
    const after = await readMarks({ goalIds });

    expect(
      after.plans
        .map((plan, index) => plan.inputVersion - (before.plans[index]?.inputVersion ?? 0))
        .toSorted((first, second) => first - second),
    ).toStrictEqual([1, 2]);
  });
});
